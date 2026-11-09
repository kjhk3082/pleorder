package dev.pleorder.app;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import org.json.JSONObject;
import java.util.ArrayDeque;
import java.util.function.Consumer;
import ai.pleos.playground.navi.helper.NaviHelper;
import ai.pleos.playground.navi.helper.listener.NaviHelperEventListener;
import ai.pleos.playground.navi.data.*;
import ai.pleos.playground.navi.constants.*;

/** Reads the vehicle destination; writes routes only after explicit user confirmation. */
final class NavigationController {
    private final Context context;
    private final Consumer<JSONObject> sink;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final ArrayDeque<Runnable> waiting = new ArrayDeque<>();
    private NaviHelper helper;
    private boolean connected, connecting, pending, reading, released;
    private int requestVersion, readVersion;
    private JSONObject pendingStore,pendingHome;
    private boolean readingWaypoints, routeSent, waypointVerified;
    private RequestWaypointInfo pendingAddition;
    NavigationController(Context context, Consumer<JSONObject> sink) { this.context=context; this.sink=sink; }
    private void emit(JSONObject data) { sink.accept(data); }
    private void destinationState(String status) { try { emit(new JSONObject().put("type","destination-state").put("status",status)); } catch(Exception ignored){} }
    private void result(boolean success,String message) { pending=false;Log.i("PleorderNavi","RESULT success="+success+" "+message);try{emit(new JSONObject().put("type","navigation").put("success",success).put("message",message));}catch(Exception ignored){} }
    private void connect(Runnable action) {
        if(released)return;
        if(connected){action.run();return;}
        waiting.add(action); if(connecting)return; connecting=true;
        try {
            if(helper==null) {
                helper=new NaviHelper(context);
                helper.addListener(new NaviHelperEventListener(){
                    @Override public void onRoutingCompleted(){handler.post(()->{verifyRoute();readDestination();});}
                    @Override public void onRouteStarted(RouteStartInfo info){handler.post(()->{verifyRoute();readDestination();});}
                    @Override public void onRouteEnded(){handler.post(()->destinationState("none"));}
                    @Override public void onWaypointChanged(WaypointChangedInfo info){handler.post(()->{verifyRoute();readDestination();});}
                    @Override public void onWayPointInfo(java.util.List<WaypointInfo> info){handler.post(()->acceptWaypoints(info));}
                    @Override public void onDestinationChanged(){handler.post(()->readDestination());}
                    @Override public void onRouteCancelled(){handler.post(()->{++readVersion;reading=false;destinationState("changing");handler.postDelayed(()->readDestination(),1500);});}
                    @Override public void onDestinationInfo(DestinationInfo info){handler.post(()->acceptDestination(info));}
                    @Override public void onError(NaviErrorCode error){handler.post(()->{if(pending)result(false,"내비게이션이 요청을 처리하지 못했어요. ("+error+")");if(reading){reading=false;destinationState("unavailable");}});}
                });
            }
            helper.initialize(()->{handler.post(()->{if(released)return;connecting=false;connected=true;while(!waiting.isEmpty())waiting.remove().run();});return kotlin.Unit.INSTANCE;}, error->{handler.post(()->{connecting=false;waiting.clear();destinationState("unavailable");if(pending)result(false,"내비게이션 서비스에 연결하지 못했어요.");});return kotlin.Unit.INSTANCE;});
        } catch(Throwable e){connecting=false;waiting.clear();destinationState("unavailable");if(pending)result(false,"내비게이션에 연결하지 못했어요.");}
    }
    void readDestination() {
        int version=++readVersion;
        connect(()->{if(released||version!=readVersion)return;try{reading=true;helper.getDestinationInfo();Log.i("PleorderNavi","DESTINATION_REQUESTED");handler.postDelayed(()->{if(reading&&readVersion==version){reading=false;destinationState("unavailable");}},5000);}catch(Throwable e){reading=false;destinationState("unavailable");}});
    }
    private void acceptDestination(DestinationInfo info) {
        if(released||!reading)return;
        reading=false;
        if(info==null){destinationState("none");return;}
        double lat=info.getLatitude(),lng=info.getLongitude();
        if(!Double.isFinite(lat)||!Double.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180||(lat==0&&lng==0)){destinationState("none");return;}
        if(pending&&pendingAddition!=null){
            if(!near(lat,lng,pendingHome)){pendingAddition=null;result(false,"차량 목적지가 바뀌었어요. 기존 경유지를 유지하려면 경로를 다시 확인해 주세요.");}
            else try{RequestWaypointInfo addition=pendingAddition;pendingAddition=null;routeSent=true;helper.addWaypoint(addition);handler.postDelayed(()->verifyRoute(),1500);}catch(Exception e){result(false,"내비게이션에 경유지를 추가하지 못했어요.");}
        }
        if(pending&&routeSent&&waypointVerified&&near(lat,lng,pendingHome))result(true,"매장 경유지와 목적지가 내비게이션에 반영됐어요.");
        try{JSONObject place=new JSONObject().put("lat",lat).put("lng",lng).put("name",info.getName()==null||info.getName().isBlank()?"차량 목적지":info.getName()).put("description",info.getAddress()==null?"":info.getAddress()).put("source","vehicle").put("remainingSeconds",info.getRemainTime()).put("remainingMeters",info.getRemainDistance()).put("measuredAt",System.currentTimeMillis());emit(new JSONObject().put("type","vehicle-destination").put("destination",place));Log.i("PleorderNavi","DESTINATION_RECEIVED");}catch(Exception ignored){}
    }
    void request(String json) {
        if(pending){try{emit(new JSONObject().put("type","navigation").put("success",false).put("message","이전 경로 요청을 확인 중이에요."));}catch(Exception ignored){}return;}
        try {
            JSONObject input=new JSONObject(json),store=input.getJSONObject("store"),home=input.getJSONObject("home");validate(store);validate(home);
            pending=true;routeSent=false;waypointVerified=false;pendingAddition=null;int version=++requestVersion;
            connect(()->{if(!pending||version!=requestVersion)return;try{
                pendingStore=store;pendingHome=home;readingWaypoints=true;
                helper.getWaypointInfo();
                Log.i("PleorderNavi","WAYPOINTS_BEFORE_ROUTE_REQUESTED");
                handler.postDelayed(()->{if(pending&&requestVersion==version)result(false,"경로 응답이 늦어지고 있어요. 내비게이션 상태를 확인해 주세요.");},8000);
            }catch(Exception e){Log.w("PleorderNavi","ROUTE_REQUEST_FAILED "+e.getClass().getSimpleName());result(false,"경로 요청을 보내지 못했어요.");}});
        }catch(Throwable e){result(false,"내비게이션 연결을 사용할 수 없어요.");}
    }
    private void acceptWaypoints(java.util.List<WaypointInfo> points){
        if(!pending||!readingWaypoints||pendingStore==null)return;
        readingWaypoints=false;
        try{
            if(routeSent){
                String expectedLabel=pendingStore.optString("name")+(pendingStore.optBoolean("realPlace")?"":" · 가상 매장");
                waypointVerified=points.stream().anyMatch(point->near(point.getLatitude(),point.getLongitude(),pendingStore)||expectedLabel.equals(point.getName()));
                if(waypointVerified)readDestination();
                return;
            }
            java.util.List<WaypointInfo> existing=new java.util.ArrayList<>();
            for(WaypointInfo point:points)if(point.getLatitude()!=0||point.getLongitude()!=0||(point.getName()!=null&&!point.getName().isBlank()))existing.add(point);
            JSONObject store=pendingStore,home=pendingHome;
            String label=store.getString("name")+(store.optBoolean("realPlace")?"":" · 가상 매장");
            boolean alreadyAdded=existing.stream().anyMatch(point->near(point.getLatitude(),point.getLongitude(),store)||label.equals(point.getName()));
            if(existing.size()>=2&&!alreadyAdded){result(false,"기존 경유지가 2개예요. 내비에서 하나를 정리한 뒤 다시 요청해 주세요.");return;}
            java.util.List<RequestWaypointInfo> waypoints=new java.util.ArrayList<>();
            if(alreadyAdded){routeSent=true;waypointVerified=true;readDestination();return;}
            if(!existing.isEmpty()){
                // Some Pleos images return waypoint names with zero coordinates.
                // addWaypoint preserves those entries without reconstructing them.
                pendingAddition=new RequestWaypointInfo(store.getDouble("lat"),store.getDouble("lng"),label,WaypointIndex.SECOND,"",store.optString("address",""),"0","");
                readDestination();return;
            }
            waypoints.add(new RequestWaypointInfo(store.getDouble("lat"),store.getDouble("lng"),label,WaypointIndex.FIRST,"",store.optString("address",""),"0",""));
            RouteInfo destination=new RouteInfo(home.getDouble("lat"),home.getDouble("lng"),null,null,home.optString("name","목적지"),"",home.optString("description",""),"0",RouteOption.RECOMMENDED,"",false);
            routeSent=true;
            helper.requestRouteWithWaypoints(new RouteWithWaypointsRequest(destination,waypoints));
            handler.postDelayed(()->verifyRoute(),2000);
            Log.i("PleorderNavi","ROUTE_WITH_PRESERVED_WAYPOINTS_REQUESTED");
        }catch(Exception e){result(false,"기존 경유지를 확인하지 못해 경로를 변경하지 않았어요.");}
    }
    private static boolean near(double lat,double lng,JSONObject point){return point!=null&&Math.abs(lat-point.optDouble("lat"))<0.0003&&Math.abs(lng-point.optDouble("lng"))<0.0003;}
    private void verifyRoute(){if(!pending||!routeSent||readingWaypoints)return;try{readingWaypoints=true;helper.getWaypointInfo();}catch(Exception e){result(false,"경유지 반영 여부를 확인하지 못했어요. 내비게이션 화면을 확인해 주세요.");}}
    private static void validate(JSONObject point)throws Exception{double lat=point.getDouble("lat"),lng=point.getDouble("lng");if(!Double.isFinite(lat)||!Double.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180)throw new IllegalArgumentException("coordinates");}
    void release(){released=true;waiting.clear();handler.removeCallbacksAndMessages(null);if(helper!=null)try{helper.release();}catch(Throwable ignored){}}
}

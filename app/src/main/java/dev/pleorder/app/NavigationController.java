package dev.pleorder.app;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import org.json.JSONObject;
import java.util.ArrayDeque;
import java.util.Collections;
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
                    @Override public void onRoutingCompleted(){if(pending)result(true,"내비게이션에서 경유 경로를 만들었어요.");}
                    @Override public void onRouteStarted(RouteStartInfo info){if(pending)result(true,"내비게이션 안내가 시작됐어요.");}
                    @Override public void onDestinationChanged(){handler.post(()->readDestination());}
                    @Override public void onRouteCancelled(){handler.post(()->{++readVersion;reading=false;destinationState("none");});}
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
        try{JSONObject place=new JSONObject().put("lat",lat).put("lng",lng).put("name",info.getName()==null||info.getName().isBlank()?"차량 목적지":info.getName()).put("description",info.getAddress()==null?"":info.getAddress()).put("source","vehicle");emit(new JSONObject().put("type","vehicle-destination").put("destination",place));Log.i("PleorderNavi","DESTINATION_RECEIVED");}catch(Exception ignored){}
    }
    void request(String json) {
        if(pending){try{emit(new JSONObject().put("type","navigation").put("success",false).put("message","이전 경로 요청을 확인 중이에요."));}catch(Exception ignored){}return;}
        try {
            JSONObject input=new JSONObject(json),store=input.getJSONObject("store"),home=input.getJSONObject("home");validate(store);validate(home);
            pending=true;int version=++requestVersion;
            connect(()->{if(!pending||version!=requestVersion)return;try{
                RouteInfo destination=new RouteInfo(home.getDouble("lat"),home.getDouble("lng"),null,null,home.optString("name","목적지"),"",home.optString("description",""),"0",RouteOption.RECOMMENDED,"",false);
                String label=store.getString("name")+(store.optBoolean("realPlace")?"":" · 가상 매장");
                RequestWaypointInfo waypoint=new RequestWaypointInfo(store.getDouble("lat"),store.getDouble("lng"),label,WaypointIndex.FIRST,"",store.optString("address",""),"0","");
                helper.requestRouteWithWaypoints(new RouteWithWaypointsRequest(destination,Collections.singletonList(waypoint)));
                Log.i("PleorderNavi","ROUTE_WITH_WAYPOINT_REQUESTED");
                handler.postDelayed(()->{if(pending&&requestVersion==version)result(false,"경로 응답이 늦어지고 있어요. 내비게이션 상태를 확인해 주세요.");},8000);
            }catch(Exception e){Log.w("PleorderNavi","ROUTE_REQUEST_FAILED "+e.getClass().getSimpleName());result(false,"경로 요청을 보내지 못했어요.");}});
        }catch(Throwable e){result(false,"내비게이션 연결을 사용할 수 없어요.");}
    }
    private static void validate(JSONObject point)throws Exception{double lat=point.getDouble("lat"),lng=point.getDouble("lng");if(!Double.isFinite(lat)||!Double.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180)throw new IllegalArgumentException("coordinates");}
    void release(){released=true;waiting.clear();handler.removeCallbacksAndMessages(null);if(helper!=null)try{helper.release();}catch(Throwable ignored){}}
}

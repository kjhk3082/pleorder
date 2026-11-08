package dev.pleorder.app;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import org.json.JSONObject;
import java.util.Collections;
import java.util.function.Consumer;
import ai.pleos.playground.navi.helper.NaviHelper;
import ai.pleos.playground.navi.helper.listener.NaviHelperEventListener;
import ai.pleos.playground.navi.data.RouteInfo;
import ai.pleos.playground.navi.data.RequestWaypointInfo;
import ai.pleos.playground.navi.data.RouteWithWaypointsRequest;
import ai.pleos.playground.navi.data.RouteStartInfo;
import ai.pleos.playground.navi.constants.RouteOption;
import ai.pleos.playground.navi.constants.WaypointIndex;
import ai.pleos.playground.navi.constants.NaviErrorCode;

/** Only called after explicit route confirmation; request != navigation success. */
final class NavigationController {
    private final Context context;
    private final Consumer<JSONObject> sink;
    private final Handler handler=new Handler(Looper.getMainLooper());
    private NaviHelper helper;
    private boolean pending;
    private int requestVersion;
    NavigationController(Context context,Consumer<JSONObject> sink){this.context=context;this.sink=sink;}
    private void result(boolean success,String message){pending=false;Log.i("PleorderNavi","RESULT success="+success+" "+message);try{sink.accept(new JSONObject().put("type","navigation").put("success",success).put("message",message));}catch(Exception ignored){}}
    void request(String json){
        if(pending){try{sink.accept(new JSONObject().put("type","navigation").put("success",false).put("message","이전 경로 요청을 확인 중이에요."));}catch(Exception ignored){}return;}
        try{
            JSONObject input=new JSONObject(json),store=input.getJSONObject("store"),home=input.getJSONObject("home");
            validate(store);validate(home);
            pending=true;int version=++requestVersion;
            if(helper==null){helper=new NaviHelper(context);helper.addListener(new NaviHelperEventListener(){
                @Override public void onRoutingCompleted(){if(pending)result(true,"내비게이션에서 경유 경로를 만들었어요.");}
                @Override public void onRouteStarted(RouteStartInfo info){if(pending)result(true,"내비게이션 안내가 시작됐어요.");}
                @Override public void onError(NaviErrorCode error){if(pending)result(false,"내비게이션이 요청을 처리하지 못했어요. ("+error+")");}
            });}
            Runnable send=()->{if(!pending||version!=requestVersion)return;try{
                RouteInfo destination=new RouteInfo(home.getDouble("lat"),home.getDouble("lng"),null,null,"우리 집 · 플레오더 데모","","잠실동 · 테스트 목적지","0",RouteOption.RECOMMENDED,"",false);
                RequestWaypointInfo waypoint=new RequestWaypointInfo(store.getDouble("lat"),store.getDouble("lng"),store.getString("name")+" · 가상 매장",WaypointIndex.FIRST,"","가상 매장","0","");
                helper.requestRouteWithWaypoints(new RouteWithWaypointsRequest(destination,Collections.singletonList(waypoint)));
                Log.i("PleorderNavi","ROUTE_WITH_WAYPOINT_REQUESTED");
                handler.postDelayed(()->{if(pending&&requestVersion==version)result(false,"안내 요청은 보냈지만 아직 경로 응답이 없어요. 내비게이션 상태를 확인해 주세요.");},8000);
            }catch(Exception e){Log.w("PleorderNavi","ROUTE_REQUEST_FAILED "+e.getClass().getSimpleName()+": "+e.getMessage());result(false,"경로 요청을 보내지 못했어요.");}};
            helper.initialize(()->{handler.post(send);return kotlin.Unit.INSTANCE;},error->{handler.post(()->{if(version==requestVersion&&pending)result(false,"내비게이션 서비스에 연결하지 못했어요.");});return kotlin.Unit.INSTANCE;});
        }catch(Throwable error){result(false,"내비게이션 연결을 사용할 수 없어요.");}
    }
    private static void validate(JSONObject point)throws Exception{double lat=point.getDouble("lat"),lng=point.getDouble("lng");if(!Double.isFinite(lat)||!Double.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180)throw new IllegalArgumentException("coordinates");}
    void release(){handler.removeCallbacksAndMessages(null);if(helper!=null)try{helper.release();}catch(Throwable ignored){}}
}


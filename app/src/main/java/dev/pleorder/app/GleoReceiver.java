package dev.pleorder.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import org.json.JSONObject;
import java.util.ArrayDeque;
import java.io.ByteArrayInputStream;
import java.util.Set;

/** Shared serialized Gleo/background engine; also accepts legacy broadcast actions. */
public final class GleoReceiver extends BroadcastReceiver {
    private static final Handler MAIN=new Handler(Looper.getMainLooper());
    private static final ArrayDeque<Job> QUEUE=new ArrayDeque<>();
    private static WebView engine;
    private static boolean ready;
    private static Job current;
    private static final long ENGINE_START_MS = 12000;
    private static final Runnable RELEASE_IDLE = () -> {
        if (current == null && QUEUE.isEmpty() && engine != null) {
            engine.destroy();
            engine = null;
            ready = false;
        }
    };
    private static long sequence;
    private static String expectedState, currentParams;
    private static int retries;
    private record Job(Context context,Intent intent,PendingResult pending,long id) {}
    @Override public void onReceive(Context context,Intent intent){
        String action=GleoActions.normalize(intent.getAction());
        if(action==null)return;
        intent=new Intent(intent).setAction(action);
        if(MainActivity.deliverGleo(intent))return;
        PendingResult pending=goAsync();
        enqueue(context,intent,pending);
    }
    static void enqueue(Context context,Intent intent,PendingResult pending){
        String action=intent.getAction();
        if(QUEUE.size()>12){respond(context,action,"fail","The action queue is busy. Please query the order status before retrying.","[]");if(pending!=null)pending.finish();return;}
        Job job = new Job(context.getApplicationContext(), new Intent(intent), pending, ++sequence);
        QUEUE.add(job);
        MAIN.removeCallbacks(RELEASE_IDLE);
        if (pending != null) MAIN.postDelayed(() -> {
            if (QUEUE.remove(job)) {
                respond(job.context, action, "fail", "주문 처리가 지연됐어요. 주문 현황을 먼저 확인해 주세요.", "[]");
                pending.finish();
            } else if (current == job) {
                respond(job.context, action, "fail", "주문 현황을 확인한 뒤 다시 말씀해 주세요.", "[]");
                finish(job);
            }
        }, 8500);
        if(engine==null)initialize(context.getApplicationContext());else runNext();
    }
    static void prepareForFollowup(Context context) {
        MAIN.post(() -> {
            MAIN.removeCallbacks(RELEASE_IDLE);
            if (engine == null) initialize(context.getApplicationContext());
            else if (ready && current == null && QUEUE.isEmpty()) MAIN.postDelayed(RELEASE_IDLE, 30000);
        });
    }
    static void track(Context context,JSONObject event){
        MAIN.post(()->{
            if(MainActivity.isForeground()){if(event!=null)MainActivity.deliverTracking(event);return;}
            if(QUEUE.size()>8)return;
            Intent intent=new Intent("TRACK_ORDERS_INTERNAL");
            try{intent.putExtra("ACTION_PARAM",new JSONObject().put("event",event).toString());}catch(Exception ignored){}
            QUEUE.add(new Job(context.getApplicationContext(),intent,null,++sequence));
            if(engine==null)initialize(context.getApplicationContext());else runNext();
        });
    }
    private static void initialize(Context context){
        ready=false;
        engine=new WebView(context);engine.getSettings().setJavaScriptEnabled(true);engine.getSettings().setAllowFileAccess(false);engine.getSettings().setAllowContentAccess(false);engine.getSettings().setBlockNetworkLoads(false);
        final WebView starting = engine;
        engine.addJavascriptInterface(new Object(){
            @JavascriptInterface public void ready(){MAIN.post(()->{
                if (engine != starting) return;
                ready=true;runNext();
                if (current == null && QUEUE.isEmpty()) MAIN.postDelayed(RELEASE_IDLE, 30000);
            });}
            @JavascriptInterface public void complete(long id,String state,String response){MAIN.post(()->{
                Job job=current;if(job==null||job.id!=id)return;
                try {
                    if (response.length() > 16000) throw new IllegalArgumentException();
                    JSONObject body = new JSONObject(response);
                    String status = body.getString("status"), message = body.getString("message");
                    if (!SimulationState.replace(job.context, expectedState, state)) {
                        if (retries++ >= 1) throw new IllegalStateException("State changed");
                        expectedState = SimulationState.read(job.context);
                        engine.evaluateJavascript("dispatch("+JSONObject.quote(job.intent.getAction())+","+currentParams+","+JSONObject.quote(expectedState)+","+job.id+")",null);
                        return;
                    }
                    MainActivity.refreshExternalState(state);
                    OrderTrackingService.ensure(job.context);
                    respond(job.context, job.intent.getAction(), status, message, body.optString("data","[]"));
                } catch (Exception error) {
                    Log.w("PleorderGleo", "STATE_COMMIT_FAILED "+job.intent.getAction()+" "+error.getClass().getSimpleName());
                    respond(job.context,job.intent.getAction(),"fail","The action result could not be stored. Query the order status before retrying.","[]");
                }
                finish(job);
            });}
        },"Headless");
        engine.setWebViewClient(new WebViewClient(){
            @Override public WebResourceResponse shouldInterceptRequest(WebView view,WebResourceRequest request){String path=request.getUrl().getPath();String host=request.getUrl().getHost();if("https".equals(request.getUrl().getScheme())&&"GET".equals(request.getMethod())&&(("oapi.map.naver.com".equals(host)&&(Set.of("/openapi/v3/maps.js","/openapi/v3/maps-geocoder.js","/v3/auth").contains(path)))||("maps.apigw.ntruss.com".equals(host)&&Set.of("/map-geocode/v2/geocode-js","/map-reversegeocode/v2/gc-js").contains(path))))return null;if("https".equals(request.getUrl().getScheme())&&"photon.komoot.io".equals(request.getUrl().getHost())&&"/api/".equals(path)&&"GET".equals(request.getMethod()))return null;if(!"appassets.androidplatform.net".equals(request.getUrl().getHost())||!Set.of("/web/data.js","/web/real-catalog.js","/web/seoul-places.json","/web/brand-menus.json","/web/payments.js","/web/catalog.js","/web/order-assistant.js","/web/order-scheduler.js","/web/core.js","/web/location-search.js","/web/voice-location.js","/web/map-sdk.js","/web/map-config.json").contains(path))return new WebResourceResponse("text/plain","UTF-8",new ByteArrayInputStream(new byte[0]));try{return new WebResourceResponse(path.endsWith(".json")?"application/json":"application/javascript","UTF-8",context.getAssets().open(path.substring(1)));}catch(Exception e){return new WebResourceResponse("text/plain","UTF-8",new ByteArrayInputStream(new byte[0]));}}
        });
        try{String html=new String(context.getAssets().open("web/headless.html").readAllBytes(),java.nio.charset.StandardCharsets.UTF_8);engine.loadDataWithBaseURL("https://appassets.androidplatform.net/web/",html,"text/html","UTF-8",null);}catch(Exception e){ready=true;while(!QUEUE.isEmpty()){Job job=QUEUE.remove();respond(job.context,job.intent.getAction(),"fail","The order engine could not start.","[]");if(job.pending!=null)job.pending.finish();}engine.destroy();engine=null;}
        MAIN.postDelayed(()->{if(!ready&&engine==starting){Log.w("PleorderGleo","ENGINE_START_TIMEOUT");while(!QUEUE.isEmpty()){Job job=QUEUE.remove();respond(job.context,job.intent.getAction(),"fail","주문 정보를 불러오는 데 시간이 걸려요. 잠시 뒤 다시 말씀해 주세요.","[]");if(job.pending!=null)job.pending.finish();}engine.destroy();engine=null;}},ENGINE_START_MS);
    }
    private static void runNext(){
        if(!ready||current!=null||QUEUE.isEmpty())return;
        MAIN.removeCallbacks(RELEASE_IDLE);
        current=QUEUE.remove();Job job=current;retries=0;
        try{JSONObject params=GleoActions.parameters(job.intent);String state=SimulationState.read(job.context);expectedState=state;currentParams=params.toString();engine.evaluateJavascript("dispatch("+JSONObject.quote(job.intent.getAction())+","+params+","+JSONObject.quote(state)+","+job.id+")",null);}catch(Exception e){respond(job.context,job.intent.getAction(),"fail","Invalid action parameters.","[]");finish(job);return;}
        MAIN.postDelayed(()->{if(current==job){Log.w("PleorderGleo","ACTION_TIMEOUT "+job.intent.getAction());respond(job.context,job.intent.getAction(),"fail","The action timed out. Query status before retrying.","[]");finish(job);}},5500);
    }
    private static void finish(Job job){if(current!=job)return;if(job.pending!=null)job.pending.finish();current=null;runNext();if(current==null&&QUEUE.isEmpty())MAIN.postDelayed(RELEASE_IDLE,30000);}
    static void respond(Context context,String action,String status,String message,String data){if("TRACK_ORDERS_INTERNAL".equals(action))return;try{JSONObject body=new JSONObject().put("functionName",action).put("status",status).put("message",message).put("data",data).put("mode","voice");context.sendBroadcast(new Intent("ai.pleos.playground.intent.action.APP_ACTION_RESPONSE").setPackage("ai.umos.ambientai").putExtra("packageName",context.getPackageName()).putExtra("response",body.toString()));Log.i("PleorderGleo","BACKGROUND_CALLBACK "+action+" status="+status);}catch(Exception ignored){}}
}

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
import org.json.JSONTokener;
import java.util.ArrayDeque;
import java.io.ByteArrayInputStream;
import java.util.Set;

/** Official component=service means a broadcast. No Activity is launched while driving. */
public final class GleoReceiver extends BroadcastReceiver {
    private static final Handler MAIN=new Handler(Looper.getMainLooper());
    private static final ArrayDeque<Job> QUEUE=new ArrayDeque<>();
    private static WebView engine;
    private static boolean ready;
    private static Job current;
    private static long sequence;
    private static String expectedState;
    private record Job(Context context,Intent intent,PendingResult pending,long id) {}
    @Override public void onReceive(Context context,Intent intent){
        String action=intent.getAction();
        if(!Set.of("PREPARE_FOOD_ORDER","CONFIRM_FOOD_ORDER","GET_FOOD_ORDER_STATUS").contains(action==null?"":action))return;
        if(MainActivity.deliverGleo(intent))return;
        PendingResult pending=goAsync();
        if(QUEUE.size()>12){respond(context,action,"fail","The action queue is busy. Please query the order status before retrying.","[]");pending.finish();return;}
        QUEUE.add(new Job(context.getApplicationContext(),new Intent(intent),pending,++sequence));
        if(engine==null)initialize(context.getApplicationContext());else runNext();
    }
    private static void initialize(Context context){
        ready=false;
        engine=new WebView(context);engine.getSettings().setJavaScriptEnabled(true);engine.getSettings().setAllowFileAccess(false);engine.getSettings().setAllowContentAccess(false);engine.getSettings().setBlockNetworkLoads(true);
        engine.addJavascriptInterface(new Object(){
            @JavascriptInterface public void ready(){MAIN.post(()->{ready=true;runNext();});}
            @JavascriptInterface public void complete(long id,String state,String response){MAIN.post(()->{
                Job job=current;if(job==null||job.id!=id)return;
                try{if(state.length()>200000||response.length()>16000)throw new IllegalArgumentException();if(!java.util.Objects.equals(expectedState,job.context.getSharedPreferences("MainActivity",Context.MODE_PRIVATE).getString("simulation-v1","")))throw new IllegalStateException("State changed");JSONObject body=new JSONObject(response);job.context.getSharedPreferences("MainActivity",Context.MODE_PRIVATE).edit().putString("simulation-v1",state).commit();MainActivity.refreshExternalState(state);respond(job.context,job.intent.getAction(),body.getString("status"),body.getString("message"),body.optString("data","[]"));}catch(Exception error){respond(job.context,job.intent.getAction(),"fail","The action result could not be stored. Query the order status before retrying.","[]");}
                finish(job);
            });}
        },"Headless");
        engine.setWebViewClient(new WebViewClient(){
            @Override public WebResourceResponse shouldInterceptRequest(WebView view,WebResourceRequest request){String path=request.getUrl().getPath();if(!"appassets.androidplatform.net".equals(request.getUrl().getHost())||!Set.of("/web/data.js","/web/real-catalog.js","/web/seoul-places.json","/web/brand-menus.json","/web/payments.js","/web/catalog.js","/web/core.js").contains(path))return new WebResourceResponse("text/plain","UTF-8",new ByteArrayInputStream(new byte[0]));try{return new WebResourceResponse(path.endsWith(".json")?"application/json":"application/javascript","UTF-8",context.getAssets().open(path.substring(1)));}catch(Exception e){return new WebResourceResponse("text/plain","UTF-8",new ByteArrayInputStream(new byte[0]));}}
        });
        try{String html=new String(context.getAssets().open("web/headless.html").readAllBytes(),java.nio.charset.StandardCharsets.UTF_8);engine.loadDataWithBaseURL("https://appassets.androidplatform.net/web/",html,"text/html","UTF-8",null);}catch(Exception e){ready=true;while(!QUEUE.isEmpty()){Job job=QUEUE.remove();respond(job.context,job.intent.getAction(),"fail","The order engine could not start.","[]");job.pending.finish();}engine.destroy();engine=null;}
        MAIN.postDelayed(()->{if(!ready&&engine!=null){ready=true;while(!QUEUE.isEmpty()){Job job=QUEUE.remove();respond(job.context,job.intent.getAction(),"fail","The order engine did not become ready. Please try again.","[]");job.pending.finish();}engine.destroy();engine=null;}},5500);
    }
    private static void runNext(){
        if(!ready||current!=null||QUEUE.isEmpty())return;
        current=QUEUE.remove();Job job=current;
        try{String raw=job.intent.getStringExtra("ACTION_PARAM");JSONObject params=new JSONObject();if(raw!=null){if(raw.length()>8192)throw new IllegalArgumentException();Object value=new JSONTokener(raw).nextValue();if(value instanceof String)value=new JSONObject((String)value);if(!(value instanceof JSONObject))throw new IllegalArgumentException();params=((JSONObject)value).optJSONObject("actionParameters");if(params==null)params=(JSONObject)value;}else for(String key:new String[]{"query","fulfillment","quantity","timing","draftId","confirmation"})if(job.intent.hasExtra(key))params.put(key,job.intent.getExtras().get(key));String state=job.context.getSharedPreferences("MainActivity",Context.MODE_PRIVATE).getString("simulation-v1","");expectedState=state;engine.evaluateJavascript("dispatch("+JSONObject.quote(job.intent.getAction())+","+params+","+JSONObject.quote(state)+","+job.id+")",null);}catch(Exception e){respond(job.context,job.intent.getAction(),"fail","Invalid action parameters.","[]");finish(job);return;}
        MAIN.postDelayed(()->{if(current==job){respond(job.context,job.intent.getAction(),"fail","The action timed out. Query status before retrying.","[]");finish(job);}},5500);
    }
    private static void finish(Job job){if(current!=job)return;job.pending.finish();current=null;runNext();MAIN.postDelayed(()->{if(current==null&&QUEUE.isEmpty()&&engine!=null){engine.destroy();engine=null;ready=false;}},30000);}
    private static void respond(Context context,String action,String status,String message,String data){try{JSONObject body=new JSONObject().put("functionName",action).put("status",status).put("message",message).put("data",data).put("mode","voice");context.sendBroadcast(new Intent("ai.pleos.playground.intent.action.APP_ACTION_RESPONSE").setPackage("ai.umos.ambientai").putExtra("packageName",context.getPackageName()).putExtra("response",body.toString()));Log.i("PleorderGleo","BACKGROUND_CALLBACK "+action+" status="+status);}catch(Exception ignored){}}
}

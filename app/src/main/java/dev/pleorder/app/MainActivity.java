package dev.pleorder.app;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.webkit.*;
import org.json.JSONObject;
import java.io.ByteArrayInputStream;
import java.util.ArrayDeque;
import java.util.Map;
import ai.pleos.playground.location.fused.FusedLocation;
import ai.pleos.playground.location.fused.listener.FusedLocationListener;
import ai.pleos.playground.location.fused.model.LocationData;

public final class MainActivity extends Activity {
    private static final String ORIGIN="https://appassets.androidplatform.net";
    private final Handler handler=new Handler(Looper.getMainLooper());
    private final ArrayDeque<JSONObject> pending=new ArrayDeque<>();
    private WebView web;
    private SpeechController speech;
    private NavigationController navigation;
    private FusedLocation fused;
    private FusedLocationListener locationListener;
    private boolean ready;
    private Object car,uxManager,uxListener;
    @Override public void onCreate(Bundle state){
        super.onCreate(state);getWindow().setStatusBarColor(0xfff5f4f0);getWindow().setNavigationBarColor(0xfff5f4f0);
        speech=new SpeechController(getApplicationContext(),this::send);
        navigation=new NavigationController(getApplicationContext(),this::send);
        web=new WebView(this);web.setBackgroundColor(0xfff5f4f0);web.getSettings().setJavaScriptEnabled(true);web.getSettings().setDomStorageEnabled(true);web.getSettings().setAllowFileAccess(false);web.getSettings().setAllowContentAccess(false);web.getSettings().setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);web.getSettings().setUserAgentString(web.getSettings().getUserAgentString()+" Pleorder/0.1.0");
        if(BuildConfig.DEBUG)WebView.setWebContentsDebuggingEnabled(true);
        web.addJavascriptInterface(new Bridge(),"Native");
        web.setWebViewClient(new WebViewClient(){
            @Override public boolean shouldOverrideUrlLoading(WebView v,WebResourceRequest r){return true;}
            @Override public WebResourceResponse shouldInterceptRequest(WebView v,WebResourceRequest r){
                Uri uri=r.getUrl();if(!"appassets.androidplatform.net".equals(uri.getHost()))return null;
                String path=uri.getPath();if(path==null||!path.startsWith("/web/")||path.contains(".."))return new WebResourceResponse("text/plain","utf-8",403,"Forbidden",Map.of(),new ByteArrayInputStream(new byte[0]));
                try{String type=path.endsWith(".js")?"application/javascript":path.endsWith(".css")?"text/css":path.endsWith(".json")?"application/json":path.endsWith(".svg")?"image/svg+xml":path.endsWith(".png")?"image/png":path.endsWith(".woff2")?"font/woff2":"text/html";return new WebResourceResponse(type,"utf-8",200,"OK",Map.of("Access-Control-Allow-Origin",ORIGIN),getAssets().open(path.substring(1)));}catch(Exception e){return new WebResourceResponse("text/plain","utf-8",404,"Not Found",Map.of(),new ByteArrayInputStream(new byte[0]));}
            }
        });
        web.setWebChromeClient(new WebChromeClient(){@Override public boolean onConsoleMessage(ConsoleMessage m){if(BuildConfig.DEBUG)Log.d("PleorderWeb",m.message()+" @"+m.lineNumber());return true;}});
        setContentView(web);web.loadUrl(ORIGIN+"/web/index.html");receive(getIntent());handler.postDelayed(this::watchDrivingRestrictions,1200);
    }
    void send(JSONObject event){handler.post(()->{if(!ready){if(pending.size()<20)pending.add(event);return;}web.evaluateJavascript("window.Pleorder&&window.Pleorder.receiveNative("+event.toString()+")",null);});}
    private void emitMessage(String type,String message){try{send(new JSONObject().put("type",type).put("message",message));}catch(Exception ignored){}}
    @Override protected void onNewIntent(Intent intent){super.onNewIntent(intent);setIntent(intent);receive(intent);}
    private void receive(Intent intent){
        String action=intent.getAction();
        if(BuildConfig.DEBUG&&intent.hasExtra("qaSpeechFile")){String name=intent.getStringExtra("qaSpeechFile");if("order.pcm".equals(name)||"confirm.pcm".equals(name)){handler.postDelayed(()->{try{speech.listen(java.nio.file.Files.readAllBytes(new java.io.File(getFilesDir(),name).toPath()));}catch(Exception e){Log.w("PleorderSpeech","PCM_MISSING");}},1200);}return;}
        if(BuildConfig.DEBUG&&intent.hasExtra("qaSpeak")){handler.postDelayed(()->speech.speak("플레오더입니다. 배달과 픽업을 음성으로 주문할 수 있어요."),1500);return;}
        if(!java.util.Set.of("PREPARE_FOOD_ORDER","CONFIRM_FOOD_ORDER","GET_FOOD_ORDER_STATUS").contains(action==null?"":action))return;
        try{
            String raw=intent.getStringExtra("ACTION_PARAM");if(raw!=null&&raw.length()>8192)throw new IllegalArgumentException("oversized");
            JSONObject params=new JSONObject();if(raw!=null){Object value=new org.json.JSONTokener(raw).nextValue();if(value instanceof String)value=new JSONObject((String)value);if(!(value instanceof JSONObject))throw new IllegalArgumentException("object required");JSONObject obj=(JSONObject)value;params=obj.optJSONObject("actionParameters");if(params==null)params=obj;}
            else if(intent.getExtras()!=null)for(String key:new String[]{"query","fulfillment","quantity","timing","draftId","confirmation"})if(intent.hasExtra(key))params.put(key,intent.getExtras().get(key));
            send(new JSONObject().put("type","gleo-action").put("name",action).put("params",params));
            Log.i("PleorderGleo","ACTION_RECEIVED "+action);
        }catch(Exception e){reply(action,"fail","Invalid action parameters.","[]");}
    }
    private void reply(String action,String status,String message,String data){try{JSONObject body=new JSONObject().put("functionName",action).put("status",status).put("message",message).put("data",data).put("mode","voice");Intent response=new Intent("ai.pleos.playground.intent.action.APP_ACTION_RESPONSE").setPackage("ai.umos.ambientai").putExtra("packageName",getPackageName()).putExtra("response",body.toString());sendBroadcast(response);Log.i("PleorderGleo","CALLBACK "+action+" status="+status);}catch(Exception ignored){}}
    private final class Bridge {
        @JavascriptInterface public String loadState(){return getPreferences(MODE_PRIVATE).getString("simulation-v1","");}
        @JavascriptInterface public void saveState(String state){if(state!=null&&state.length()<200000)getPreferences(MODE_PRIVATE).edit().putString("simulation-v1",state).apply();}
        @JavascriptInterface public void ready(){handler.post(()->{ready=true;while(!pending.isEmpty())send(pending.remove());Log.i("Pleorder","UI_READY");});}
        @JavascriptInterface public void startListening(){handler.post(()->{if(checkSelfPermission(Manifest.permission.RECORD_AUDIO)!=PackageManager.PERMISSION_GRANTED){requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO},20);}else speech.listen(null);});}
        @JavascriptInterface public void stopSpeech(){handler.post(()->speech.stop());}
        @JavascriptInterface public void speak(String text){handler.post(()->speech.speak(text));}
        @JavascriptInterface public void requestLocation(){handler.post(()->location());}
        @JavascriptInterface public void navigate(String payload){if(payload!=null&&payload.length()<5000)handler.post(()->navigation.request(payload));}
        @JavascriptInterface public void replyAction(String payload){if(payload==null||payload.length()>12000)return;try{JSONObject p=new JSONObject(payload);reply(p.getString("functionName"),p.getString("status"),p.getString("message"),p.optString("data","[]"));}catch(Exception e){Log.w("PleorderGleo","INVALID_CALLBACK");}}
    }
    private void location(){try{if(fused==null){fused=new FusedLocation(getApplicationContext());if(!fused.isSupported()){emitMessage("speech-error","이 환경에서는 차량 위치를 제공하지 않아요.");fused.release();fused=null;return;}fused.initialize();locationListener=new FusedLocationListener(){
        @Override public void onChanged(LocationData d){if(d==null)return;try{send(new JSONObject().put("type","location").put("lat",d.getLatitude()).put("lng",d.getLongitude()));}catch(Exception ignored){}}
        @Override public void onError(Exception e){emitMessage("speech-error","차량 위치를 가져오지 못했어요. 데모 경로는 계속 사용할 수 있어요.");}
    };handler.postDelayed(()->{if(fused!=null){fused.getLastKnownLocation(locationListener);fused.registerFusedLocationCallback(locationListener);}},1800);}else fused.getLastKnownLocation(locationListener);}catch(Throwable e){emitMessage("speech-error","차량 위치 연결을 확인해 주세요.");}}
    /** Use the platform restriction manager when present; never claim distraction optimization. */
    private void watchDrivingRestrictions(){try{
        Class<?> carClass=Class.forName("android.car.Car");car=carClass.getMethod("createCar",android.content.Context.class).invoke(null,this);uxManager=carClass.getMethod("getCarManager",String.class).invoke(car,"uxrestriction");
        Class<?> listenerClass=Class.forName("android.car.drivingstate.CarUxRestrictionsManager$OnUxRestrictionsChangedListener");
        uxListener=java.lang.reflect.Proxy.newProxyInstance(listenerClass.getClassLoader(),new Class[]{listenerClass},(p,m,args)->{if(m.getName().equals("onUxRestrictionsChanged"))restriction(args[0]);return null;});
        uxManager.getClass().getMethod("registerListener",listenerClass).invoke(uxManager,uxListener);restriction(uxManager.getClass().getMethod("getCurrentCarUxRestrictions").invoke(uxManager));
    }catch(Throwable e){Log.w("Pleorder","UX_RESTRICTION_MANAGER_UNAVAILABLE");}}
    private void restriction(Object value){try{boolean restricted=(boolean)value.getClass().getMethod("isRequiresDistractionOptimization").invoke(value);send(new JSONObject().put("type","restriction").put("restricted",restricted));}catch(Exception ignored){}}
    @Override public void onRequestPermissionsResult(int requestCode,String[] permissions,int[] result){super.onRequestPermissionsResult(requestCode,permissions,result);if(requestCode==20){if(result.length>0&&result[0]==PackageManager.PERMISSION_GRANTED)speech.listen(null);else emitMessage("speech-error","마이크 권한이 필요해요. 화면에서 주문할 수도 있어요.");}}
    @Override protected void onStop(){speech.stop();super.onStop();}
    @Override protected void onDestroy(){speech.stop();navigation.release();if(fused!=null){try{fused.unregisterFusedLocationCallback(locationListener);fused.release();}catch(Throwable ignored){}}if(uxManager!=null)try{uxManager.getClass().getMethod("unregisterListener").invoke(uxManager);}catch(Throwable ignored){}if(car!=null)try{car.getClass().getMethod("disconnect").invoke(car);}catch(Throwable ignored){}handler.removeCallbacksAndMessages(null);web.removeJavascriptInterface("Native");web.destroy();super.onDestroy();}
}



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

public class MainActivity extends Activity {
    protected boolean drivingSurface(){return false;}
    private boolean switchingSurface;
    private boolean policyChecked;
    private static final String ORDER_REQUESTS = "dev.pleorder.app.pendingOrders";
    private final ArrayDeque<Intent> orderRequests = new ArrayDeque<>();
    private static java.lang.ref.WeakReference<MainActivity> active=new java.lang.ref.WeakReference<>(null);
    static boolean isForeground(){MainActivity a=active.get();return a!=null&&a.foreground&&a.ready&&!a.isFinishing();}
    static void deliverTracking(JSONObject event){MainActivity a=active.get();if(a!=null)a.send(event);}
    static boolean deliverGleo(Intent intent){MainActivity activity=active.get();if(activity==null||activity.isFinishing()||activity.switchingSurface||!activity.ready||!activity.foreground)return false;activity.receive(intent);return true;}
    static void refreshExternalState(String state){MainActivity activity=active.get();if(activity!=null)try{activity.send(new JSONObject().put("type","external-state").put("state",state));}catch(Exception ignored){}}
    private static final String ORIGIN="https://appassets.androidplatform.net";
    private final Handler handler=new Handler(Looper.getMainLooper());
    private final ArrayDeque<JSONObject> pending=new ArrayDeque<>();
    private WebView web;
    private boolean foreground;
    private SpeechController speech;
    private NavigationController navigation;
    private FusedLocation fused;
    private FusedLocationListener locationListener;
    private boolean ready;
    private Object car,uxManager,uxListener;
    private String pendingNavigation;
    @Override public void onCreate(Bundle state){
        super.onCreate(state);active=new java.lang.ref.WeakReference<>(this);getWindow().setStatusBarColor(0xfff5f4f0);getWindow().setNavigationBarColor(0xfff5f4f0);
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
        setContentView(web);web.loadUrl(ORIGIN+"/web/"+(drivingSurface()?"driving.html":"index.html"));if (state != null) restoreOrders(state); else acceptEntry(getIntent());
        watchDrivingRestrictions();
    }
    void send(JSONObject event){handler.post(()->{String eventType=event.optString("type");if(!foreground&&(eventType.equals("vehicle-destination")||eventType.equals("destination-state"))){GleoReceiver.track(getApplicationContext(),event);return;}if(!foreground&&eventType.equals("location"))return;if(!ready){if(pending.size()<20)pending.add(event);return;}web.evaluateJavascript("window.Pleorder&&window.Pleorder.receiveNative("+event.toString()+")",null);});}
    private void emitMessage(String type,String message){try{send(new JSONObject().put("type",type).put("message",message));}catch(Exception ignored){}}
    @Override protected void onNewIntent(Intent intent){super.onNewIntent(intent);setIntent(intent);acceptEntry(intent);drainOrders();}
    private void acceptEntry(Intent intent) {
        if (intent == null) return;
        if (intent.hasExtra(ORDER_REQUESTS)) restoreOrders(intent.getExtras());
        String action = GleoActions.normalize(intent.getAction());
        if (GleoActions.opensOrder(action)) queueOrder(intent);
        else receive(intent);
    }
    private void queueOrder(Intent intent) {
        if (!GleoActions.opensOrder(GleoActions.normalize(intent.getAction()))) return;
        if (orderRequests.size() < 12) orderRequests.add(intent);
        else reply(GleoActions.normalize(intent.getAction()), "fail", "이전 요청을 처리 중이에요. 잠시 후 다시 말씀해 주세요.", "[]");
    }
    private void restoreOrders(Bundle saved) {
        java.util.ArrayList<?> requests = saved.getParcelableArrayList(ORDER_REQUESTS);
        if (requests != null) for (Object request : requests) if (request instanceof Intent) queueOrder((Intent) request);
    }
    @Override protected void onSaveInstanceState(Bundle saved) {
        super.onSaveInstanceState(saved);
        saved.putParcelableArrayList(ORDER_REQUESTS, new java.util.ArrayList<>(orderRequests));
    }
    private void drainOrders() {
        if (!ready || !foreground || !policyChecked || switchingSurface || isFinishing()) return;
        while (!orderRequests.isEmpty()) receive(orderRequests.remove());
    }
    private void receive(Intent intent){
        String action=GleoActions.normalize(intent.getAction());
        if(BuildConfig.DEBUG&&intent.hasExtra("qaSpeechFile")){String name=intent.getStringExtra("qaSpeechFile");if(java.util.Set.of("order.pcm","confirm.pcm","status.pcm","decline.pcm","card-a.pcm","card-b.pcm","cancel.pcm").contains(name)){handler.postDelayed(()->{try{speech.listen(java.nio.file.Files.readAllBytes(new java.io.File(getFilesDir(),name).toPath()));}catch(Exception e){Log.w("PleorderSpeech","PCM_MISSING");}},1800);}return;}
        if(BuildConfig.DEBUG&&intent.hasExtra("qaSpeak")){handler.postDelayed(()->speech.speak("플레오더입니다. 배달과 픽업을 음성으로 주문할 수 있어요."),1500);return;}
        if (action == null) return;
        try {
            JSONObject params = GleoActions.parameters(intent);
            send(new JSONObject().put("type","gleo-action").put("name",action).put("params",params));
            Log.i("PleorderGleo","ACTION_RECEIVED "+action);
        }catch(Exception e){reply(action,"fail","Invalid action parameters.","[]");}
    }
    private void reply(String action,String status,String message,String data){try{JSONObject body=new JSONObject().put("functionName",action).put("status",status).put("message",message).put("data",data).put("mode","voice");Intent response=new Intent("ai.pleos.playground.intent.action.APP_ACTION_RESPONSE").setPackage("ai.umos.ambientai").putExtra("packageName",getPackageName()).putExtra("response",body.toString());sendBroadcast(response);if("PREPARE_FOOD_ORDER".equals(action)&&"asking".equals(status))GleoReceiver.prepareForFollowup(getApplicationContext());Log.i("PleorderGleo","CALLBACK "+action+" status="+status);}catch(Exception ignored){}}
    private final class Bridge {
        @JavascriptInterface public String loadState() { return SimulationState.read(MainActivity.this); }
        @JavascriptInterface public boolean saveState(String state, String expected) {
            if (!SimulationState.replace(MainActivity.this, expected, state)) return false;
            handler.post(() -> { if (foreground) OrderTrackingService.ensure(MainActivity.this); });
            return true;
        }
        @JavascriptInterface public void ready(){handler.post(()->{ready=true;while(!pending.isEmpty())send(pending.remove());drainOrders();if(checkSelfPermission("pleos.car.permission.NAVI_ROUTE")==PackageManager.PERMISSION_GRANTED)navigation.readDestination();Log.i("Pleorder","UI_READY");});}
        @JavascriptInterface public void startListening(){handler.post(()->{if(checkSelfPermission(Manifest.permission.RECORD_AUDIO)!=PackageManager.PERMISSION_GRANTED){if(drivingSurface())emitMessage("speech-error","주차 후 마이크 권한을 허용해 주세요.");else requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO},20);}else speech.listen(null);});}
        @JavascriptInterface public void startGleo(){handler.post(()->{
            speech.stop();
            boolean shown=false;
            try{shown=showAssist(new Bundle());}catch(Exception ignored){}
            Log.i("PleorderGleo","ASSIST_REQUEST shown="+shown);
            if(!shown)emitMessage("gleo-unavailable","차량 음성 서비스를 열 수 없어 앱 마이크를 사용합니다.");
        });}
        @JavascriptInterface public void stopSpeech(){handler.post(()->speech.stop());}
        @JavascriptInterface public void speak(String text){handler.post(()->speech.speak(text));}
        @JavascriptInterface public void requestLocation(){handler.post(()->location());}
        @JavascriptInterface public void requestDestination(){handler.post(()->{if(checkSelfPermission("pleos.car.permission.NAVI_ROUTE")==PackageManager.PERMISSION_GRANTED)navigation.readDestination();else requestPermissions(new String[]{"pleos.car.permission.NAVI_ROUTE"},31);});}
        @JavascriptInterface public void openExternal(String url){if(drivingSurface())return;handler.post(()->{try{Uri uri=Uri.parse(url);if(("https".equals(uri.getScheme())||"http".equals(uri.getScheme()))&&uri.getHost()!=null)startActivity(new Intent(Intent.ACTION_VIEW,uri));}catch(Exception ignored){}});}
        @JavascriptInterface public void navigate(String payload){if(payload!=null&&payload.length()<5000)handler.post(()->requestNavigation(payload));}
        @JavascriptInterface public void replyAction(String payload){if(payload==null||payload.length()>12000)return;try{JSONObject p=new JSONObject(payload);reply(p.getString("functionName"),p.getString("status"),p.getString("message"),p.optString("data","[]"));}catch(Exception e){Log.w("PleorderGleo","INVALID_CALLBACK");}}
    }
    private void location(){try{if(fused==null){fused=new FusedLocation(getApplicationContext());if(!fused.isSupported()){emitMessage("speech-error","이 환경에서는 차량 위치를 제공하지 않아요.");fused.release();fused=null;return;}fused.initialize();locationListener=new FusedLocationListener(){
        @Override public void onChanged(LocationData d){if(d==null)return;try{send(new JSONObject().put("type","location").put("lat",d.getLatitude()).put("lng",d.getLongitude()));}catch(Exception ignored){}}
        @Override public void onError(Exception e){emitMessage("speech-error","차량 위치를 가져오지 못했어요. 데모 경로는 계속 사용할 수 있어요.");}
    };handler.postDelayed(()->{if(fused!=null){fused.getLastKnownLocation(locationListener);fused.registerFusedLocationCallback(locationListener);}},1800);}else fused.getLastKnownLocation(locationListener);}catch(Throwable e){emitMessage("speech-error","차량 위치 연결을 확인해 주세요.");}}
    /** Only the separate, bounded voice surface declares distraction optimization. */
    private void watchDrivingRestrictions(){try{
        Class<?> carClass=Class.forName("android.car.Car");car=carClass.getMethod("createCar",android.content.Context.class).invoke(null,this);uxManager=carClass.getMethod("getCarManager",String.class).invoke(car,"uxrestriction");
        if(BuildConfig.DEBUG)try{
            Object packages=carClass.getMethod("getCarManager",String.class).invoke(car,"package");
            Object allowed=packages.getClass().getMethod("isActivityDistractionOptimized",String.class,String.class).invoke(packages,getPackageName(),getClass().getName());
            Log.i("PleorderUx","PLATFORM_DO_RECOGNIZED="+allowed+" activity="+getClass().getSimpleName());
        }catch(Throwable ignored){Log.i("PleorderUx","PLATFORM_DO_DIAGNOSTIC_UNAVAILABLE");}
        Class<?> listenerClass=Class.forName("android.car.drivingstate.CarUxRestrictionsManager$OnUxRestrictionsChangedListener");
        uxListener=java.lang.reflect.Proxy.newProxyInstance(listenerClass.getClassLoader(),new Class[]{listenerClass},(p,m,args)->{if(m.getName().equals("onUxRestrictionsChanged"))restriction(args[0]);return null;});
        uxManager.getClass().getMethod("registerListener",listenerClass).invoke(uxManager,uxListener);restriction(uxManager.getClass().getMethod("getCurrentCarUxRestrictions").invoke(uxManager));
    }catch(Throwable e){policyChecked=true;switchSurfaceIfNeeded(true);drainOrders();Log.w("Pleorder","UX_RESTRICTION_MANAGER_UNAVAILABLE");try{send(new JSONObject().put("type","restriction").put("requiresDo",true).put("known",false));}catch(Exception ignored){}}}
    private void restriction(Object value){
        try{
            Class<?> type=value.getClass();
            boolean requiresDo=(boolean)type.getMethod("isRequiresDistractionOptimization").invoke(value);
            int mask=(int)type.getMethod("getActiveRestrictions").invoke(value);
            JSONObject event=new JSONObject().put("type","restriction").put("requiresDo",requiresDo).put("known",true).put("activeRestrictions",mask);
            for(String[] field:new String[][]{{"maxStringLength","getMaxRestrictedStringLength"},{"maxContentItems","getMaxCumulativeContentItems"},{"maxContentDepth","getMaxContentDepth"}})
                event.put(field[0],type.getMethod(field[1]).invoke(value));
            send(event);
            policyChecked=true;
            switchSurfaceIfNeeded(requiresDo);
            drainOrders();
            Log.i("PleorderUx","DO="+requiresDo+" mask=0x"+Integer.toHexString(mask));
        }catch(Exception e){
            policyChecked=true;switchSurfaceIfNeeded(true);drainOrders();Log.w("PleorderUx","UX_POLICY_UNAVAILABLE");
            try{send(new JSONObject().put("type","restriction").put("requiresDo",true).put("known",false));}catch(Exception ignored){}
        }
    }
    private void switchSurfaceIfNeeded(boolean requiresDo){
        if(switchingSurface||isFinishing()||drivingSurface()==requiresDo)return;
        switchingSurface=true;
        // State writes are synchronous. Persist the current clock before changing surfaces.
        web.evaluateJavascript("window.Pleorder&&window.Pleorder.suspend&&window.Pleorder.suspend()",ignored->{
            Intent next=new Intent(this,requiresDo?DrivingActivity.class:MainActivity.class);
            next.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP|Intent.FLAG_ACTIVITY_SINGLE_TOP);
            if (!orderRequests.isEmpty()) {
                next.putParcelableArrayListExtra(ORDER_REQUESTS, new java.util.ArrayList<>(orderRequests));
                orderRequests.clear();
            }
            startActivity(next);finish();
        });
    }
    private void requestNavigation(String payload){String[] permissions={"pleos.car.permission.NAVI_ROUTE","pleos.car.permission.NAVI_ROUTE_SEARCH"};boolean granted=true;for(String permission:permissions)granted&=checkSelfPermission(permission)==PackageManager.PERMISSION_GRANTED;if(granted)navigation.request(payload);else{pendingNavigation=payload;requestPermissions(permissions,30);}}
    @Override public void onRequestPermissionsResult(int requestCode,String[] permissions,int[] result){super.onRequestPermissionsResult(requestCode,permissions,result);if(requestCode==20){if(result.length>0&&result[0]==PackageManager.PERMISSION_GRANTED)speech.listen(null);else emitMessage("speech-error","마이크 권한이 필요해요. 화면에서 주문할 수도 있어요.");}if(requestCode==31){if(result.length>0&&result[0]==PackageManager.PERMISSION_GRANTED)navigation.readDestination();}if(requestCode==30){boolean granted=result.length>0;for(int value:result)granted&=value==PackageManager.PERMISSION_GRANTED;String payload=pendingNavigation;pendingNavigation=null;if(granted&&payload!=null)navigation.request(payload);else try{send(new JSONObject().put("type","navigation").put("success",false).put("message","내비게이션 경로 권한이 필요해요."));}catch(Exception ignored){}}}
    @Override protected void onResume(){
        super.onResume();active=new java.lang.ref.WeakReference<>(this);foreground=true;OrderTrackingService.ensure(this);
        if(ready)try{send(new JSONObject().put("type","external-state").put("state",getSharedPreferences("MainActivity",MODE_PRIVATE).getString("simulation-v1","")));send(new JSONObject().put("type","visibility").put("visible",true));}catch(Exception ignored){}
        if(uxManager!=null)try{restriction(uxManager.getClass().getMethod("getCurrentCarUxRestrictions").invoke(uxManager));}catch(Exception ignored){}
        drainOrders();
        if(ready&&checkSelfPermission("pleos.car.permission.NAVI_ROUTE")==PackageManager.PERMISSION_GRANTED)navigation.readDestination();
    }
    @Override protected void onPause(){foreground=false;try{send(new JSONObject().put("type","visibility").put("visible",false));}catch(Exception ignored){}super.onPause();}
    @Override protected void onStop(){speech.stop();super.onStop();}
    @Override protected void onDestroy(){if(active.get()==this)active.clear();speech.stop();navigation.release();if(fused!=null){try{fused.unregisterFusedLocationCallback(locationListener);fused.release();}catch(Throwable ignored){}}if(uxManager!=null)try{uxManager.getClass().getMethod("unregisterListener").invoke(uxManager);}catch(Throwable ignored){}if(car!=null)try{car.getClass().getMethod("disconnect").invoke(car);}catch(Throwable ignored){}handler.removeCallbacksAndMessages(null);web.removeJavascriptInterface("Native");web.destroy();super.onDestroy();}
}

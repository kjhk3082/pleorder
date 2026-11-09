package dev.pleorder.app;

import android.app.*;
import android.content.*;
import android.os.*;
import org.json.*;

/** Foreground lifetime only while simulated orders are pending. No real dispatch/payment. */
public final class OrderTrackingService extends Service {
    private final Handler handler=new Handler(Looper.getMainLooper());
    private NavigationController navigation;
    private int ticks;
    private long idleUntil;
    private final Runnable tick=new Runnable(){public void run(){
        if(!hasOrders(OrderTrackingService.this)){
            if(System.currentTimeMillis()>idleUntil){stopSelf();return;}
            handler.postDelayed(this,5000);return;
        }
        if(!MainActivity.isForeground())GleoReceiver.track(OrderTrackingService.this,null);
        if(++ticks%6==0)navigation.readDestination();
        handler.postDelayed(this,5000);
    }};
    static boolean hasOrders(Context context){try{
        String state=context.getSharedPreferences("MainActivity",MODE_PRIVATE).getString("simulation-v1","");
        JSONObject data=new JSONObject(state);JSONArray orders=data.optJSONArray("orders");
        if(orders!=null)for(int i=0;i<orders.length();i++)if(!java.util.Set.of("completed","cancelled").contains(orders.getJSONObject(i).optString("stage")))return true;
    }catch(Exception ignored){}return false;}
    static void ensure(Context context){if(hasOrders(context))try{context.startForegroundService(new Intent(context,OrderTrackingService.class));}catch(RuntimeException ignored){}}
    @Override public void onCreate(){super.onCreate();
        idleUntil=System.currentTimeMillis()+120000;
        NotificationManager manager=getSystemService(NotificationManager.class);
        manager.createNotificationChannel(new NotificationChannel("order-tracking","주문 진행",NotificationManager.IMPORTANCE_LOW));
        PendingIntent open=PendingIntent.getActivity(this,0,new Intent(this,DrivingActivity.class),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
        startForeground(207,new Notification.Builder(this,"order-tracking").setSmallIcon(dev.pleorder.app.R.drawable.ic_pleorder).setContentTitle("플레오더 주문 진행 중").setContentText("예약과 배달 상태를 확인하고 있어요 · 모의 주문").setOngoing(true).setContentIntent(open).build());
        navigation=new NavigationController(getApplicationContext(),event->{
            if(MainActivity.isForeground())MainActivity.deliverTracking(event);
            else GleoReceiver.track(getApplicationContext(),event);
        });
        navigation.readDestination();handler.post(tick);
    }
    @Override public int onStartCommand(Intent intent,int flags,int id){idleUntil=System.currentTimeMillis()+120000;return START_STICKY;}
    @Override public IBinder onBind(Intent intent){return null;}
    @Override public void onDestroy(){handler.removeCallbacksAndMessages(null);if(navigation!=null)navigation.release();super.onDestroy();}
}

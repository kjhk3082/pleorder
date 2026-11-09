package dev.pleorder.app;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;

/** Gleo's activity entry grants a normal visible lifecycle to start tracking.
 * Transparent, no UI/input, no route changes. Work stays in the shared engine. */
public final class GleoActionActivity extends Activity {
    private boolean delivered;
    @Override public void onCreate(Bundle state){super.onCreate(state);getWindow().setDimAmount(0);}
    @Override public void onNewIntent(Intent intent){super.onNewIntent(intent);setIntent(intent);delivered=false;}
    @Override public void onResume(){super.onResume();
        if(delivered)return;delivered=true;
        final String action=GleoActions.normalize(getIntent().getAction());
        if(action==null){finish();return;}
        new Handler(getMainLooper()).postDelayed(()->{
            if(isFinishing())return;
            try{startForegroundService(new Intent(this,OrderTrackingService.class));}catch(RuntimeException ignored){}
            Intent request=new Intent(getIntent()).setAction(action);
            finish();overridePendingTransition(0,0);
            new Handler(getMainLooper()).postDelayed(()->{if(!MainActivity.deliverGleo(request))GleoReceiver.enqueue(getApplicationContext(),request,null);},200);
        },150);
    }
}

package dev.pleorder.app;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;

/** Routes the user-initiated App Schema activity. A status question preserves the previous screen. */
public final class GleoActionActivity extends Activity {
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setDimAmount(0);
        if (state == null) dispatch(getIntent());
        finish();
    }

    @Override public void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        dispatch(intent);
        finish();
    }

    private void dispatch(Intent intent) {
        String action = GleoActions.normalize(intent.getAction());
        if (action == null) return;
        Intent request = new Intent(action);
        try {
            request.putExtra("ACTION_PARAM", GleoActions.parameters(intent).toString());
        } catch (Exception invalid) {
            GleoReceiver.respond(this, action, "fail", "요청 내용을 다시 말씀해 주세요.", "[]");
            return;
        }
        if (GleoActions.opensOrder(action)) {
            // Enter through the DO launcher. The vehicle policy selects the final surface.
            request.setClass(this, DrivingActivity.class)
                   .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            startActivity(request);
        } else {
            try { startForegroundService(new Intent(this, OrderTrackingService.class)); }
            catch (RuntimeException unavailable) { /* Scheduling is retried after the action commits. */ }
            // A translucent assistant entry pauses the underlying Activity. Let it resume
            // before selecting the UI engine, so the checkout keeps ownership of its quote.
            Context context = getApplicationContext();
            new Handler(Looper.getMainLooper()).postDelayed(() -> {
                if (!MainActivity.deliverGleo(request)) GleoReceiver.enqueue(context, request, null);
            }, 250);
        }
    }
}

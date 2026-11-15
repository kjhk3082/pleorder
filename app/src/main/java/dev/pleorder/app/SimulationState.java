package dev.pleorder.app;

import android.content.Context;
import android.content.SharedPreferences;

/** The UI and the Gleo worker may complete on different threads. */
final class SimulationState {
    private static SharedPreferences preferences(Context context) {
        return context.getSharedPreferences("MainActivity", Context.MODE_PRIVATE);
    }

    static synchronized String read(Context context) {
        return preferences(context).getString("simulation-v1", "");
    }

    static synchronized boolean replace(Context context, String expected, String next) {
        if (next == null || next.length() > 200000 || !read(context).equals(expected)) return false;
        return preferences(context).edit().putString("simulation-v1", next).commit();
    }
}

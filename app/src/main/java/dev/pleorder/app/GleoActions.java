package dev.pleorder.app;

import android.content.Intent;
import android.os.Bundle;
import org.json.JSONException;
import org.json.JSONObject;
import org.json.JSONTokener;

/** Supports documented bare actions and the namespaced actions sent by Gleo 4.2.0.15. */
final class GleoActions {
    static boolean opensOrder(String action) {
        return "FIND_FOOD".equals(action) || "PREPARE_FOOD_ORDER".equals(action);
    }

    /** Some Gleo versions wrap arguments as JSON; the public contract also supports typed extras. */
    static JSONObject parameters(Intent intent) throws JSONException {
        Bundle extras = intent.getExtras();
        if (extras == null) return new JSONObject();
        String raw = intent.getStringExtra("ACTION_PARAM");
        if (raw != null) {
            if (raw.length() > 8192) throw new JSONException("Oversized action");
            Object value = new JSONTokener(raw).nextValue();
            if (value instanceof String) value = new JSONObject((String) value);
            if (!(value instanceof JSONObject)) throw new JSONException("Expected action object");
            JSONObject object = (JSONObject) value;
            return object.has("actionParameters") ? object.getJSONObject("actionParameters") : object;
        }
        JSONObject params = new JSONObject();
        for (String key : new String[]{"action", "add", "answer", "clear", "confirmation", "detail", "draftId", "excludeRecent",
                "fulfillment", "items", "location", "menu", "note", "option", "paymentMethod", "quantity",
                "query", "remove", "reorder", "request", "selection", "storeId", "target", "timing",
                "utterance"}) {
            if (extras.containsKey(key)) params.put(key, JSONObject.wrap(extras.get(key)));
        }
        if (params.toString().length() > 8192) throw new JSONException("Oversized action");
        return params;
    }

    static String normalize(String action){
        if(action==null)return null;
        String prefix="dev.pleorder.app.";
        if(action.startsWith(prefix))action=action.substring(prefix.length());
        return java.util.Set.of("FIND_FOOD","MANAGE_FOOD_ORDER","PREPARE_FOOD_ORDER","CONFIRM_FOOD_ORDER","GET_FOOD_ORDER_STATUS","SEARCH_DELIVERY_DESTINATION","CONFIRM_DELIVERY_DESTINATION","SET_DELIVERY_ADDRESS_DETAIL").contains(action)?action:null;
    }
}

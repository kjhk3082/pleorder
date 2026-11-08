package dev.pleorder.app;

/** Supports documented bare actions and the namespaced actions sent by Gleo 4.2.0.15. */
final class GleoActions {
    static String normalize(String action){
        if(action==null)return null;
        String prefix="dev.pleorder.app.";
        if(action.startsWith(prefix))action=action.substring(prefix.length());
        return java.util.Set.of("PREPARE_FOOD_ORDER","CONFIRM_FOOD_ORDER","GET_FOOD_ORDER_STATUS").contains(action)?action:null;
    }
}

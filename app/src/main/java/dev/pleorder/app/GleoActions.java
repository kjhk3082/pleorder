package dev.pleorder.app;

/** Supports documented bare actions and the namespaced actions sent by Gleo 4.2.0.15. */
final class GleoActions {
    static String normalize(String action){
        if(action==null)return null;
        String prefix="dev.pleorder.app.";
        if(action.startsWith(prefix))action=action.substring(prefix.length());
        return java.util.Set.of("FIND_FOOD","MANAGE_FOOD_ORDER","PREPARE_FOOD_ORDER","CONFIRM_FOOD_ORDER","GET_FOOD_ORDER_STATUS","SEARCH_DELIVERY_DESTINATION","CONFIRM_DELIVERY_DESTINATION","SET_DELIVERY_ADDRESS_DETAIL").contains(action)?action:null;
    }
}

package dev.pleorder.app;

import android.content.Context;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import java.util.Locale;
import org.json.JSONObject;
import java.util.function.Consumer;
import java.util.concurrent.atomic.AtomicBoolean;
import ai.pleos.playground.stt.SpeechToText;
import ai.pleos.playground.tts.TextToSpeech;

/** Public Pleos ON_DEVICE adapters. No server credential or private Gleo endpoint is used. */
final class SpeechController {
    private final Context context;
    private final Consumer<JSONObject> sink;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final AudioManager audio;
    private SpeechToText stt;
    private ai.pleos.playground.stt.listener.ResultListener sttListener;
    private TextToSpeech tts;
    private AudioFocusRequest focus;
    private int generation;
    SpeechController(Context context, Consumer<JSONObject> sink) { this.context=context;this.sink=sink;this.audio=(AudioManager)context.getSystemService(Context.AUDIO_SERVICE); }
    private void event(String type,String key,Object value) {try{sink.accept(new JSONObject().put("type",type).put(key,value));}catch(Exception ignored){}}
    private void error(String text) {event("speech-error","message",text);}
    private boolean focus(int token) {
        focus=new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
            .setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ASSISTANT).setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build())
            .setOnAudioFocusChangeListener(change->{if(token==generation&&change<0)stop();},handler).build();
        return audio.requestAudioFocus(focus)==AudioManager.AUDIOFOCUS_REQUEST_GRANTED;
    }
    void listen(byte[] pcm) {
        stop();final int token=++generation;
        if(!focus(token)){error("다른 오디오가 사용 중이에요. 잠시 후 다시 말해 주세요.");return;}
        final AtomicBoolean finalDelivered=new AtomicBoolean(false);
        event("speech-preparing","preparing",true);
        Log.i("PleorderSpeech","STT_INITIALIZING session="+token);
        final Runnable initializationTimeout=()->{if(token==generation){stop();error("음성 엔진 준비가 지연되고 있어요. 마이크를 눌러 다시 시도해 주세요.");}};
        handler.postDelayed(initializationTimeout,10000);
        try {
            stt=new SpeechToText(context,ai.pleos.playground.stt.constant.Mode.ON_DEVICE);
            stt.initialize(new ai.pleos.playground.stt.listener.OnInitializeListener(){
                @Override public void onSuccess(){handler.post(()->{
                    if(token!=generation||stt==null)return;
                    handler.removeCallbacks(initializationTimeout);
                    stt.setLocale(Locale.KOREA);
                    sttListener=new ai.pleos.playground.stt.listener.ResultListener(){
                        @Override public void onReady(){handler.post(()->{if(token==generation){Log.i("PleorderSpeech","STT_READY session="+token);event("speech-ready","ready",true);}});}
                        @Override public void onStartedRecognition(){Log.i("PleorderSpeech","STT_STARTED session="+token);}
                        @Override public void onUpdated(String text,boolean complete){
                            handler.post(()->{
                            if(token!=generation||finalDelivered.get())return;
                            if(complete&&!finalDelivered.compareAndSet(false,true))return;
                            if(text==null||text.trim().isEmpty()){
                                if(complete){stop();error("말씀을 듣지 못했어요. 마이크를 누르고 다시 말씀해 주세요.");}
                                return;
                            }
                            if(complete){clearStt();abandon();}
                            try{sink.accept(new JSONObject().put("type","speech-result").put("text",text).put("final",complete));Log.i("PleorderSpeech","STT_RESULT session="+token+" final="+complete);}catch(Exception ignored){}
                            });
                        }
                        @Override public void onUpdatedEpdData(long on,long off){}
                        @Override public void onUpdatedRms(double rms){}
                        @Override public void onEndedRecognition(){handler.post(()->{if(token==generation){event("speech-end","ended",true);abandon();}});}
                        @Override public void onError(ai.pleos.playground.stt.constant.ErrorType e){handler.post(()->{if(token==generation&&!finalDelivered.get()){Log.w("PleorderSpeech","STT_ERROR "+e);stop();error("잘 듣지 못했어요. 마이크를 누르고 다시 말해 주세요. ("+e+")");}});}
                    };
                    stt.addListener(sttListener);
                    if(pcm!=null){stt.sendAudio(pcm);stt.completeAudioSend();}else stt.request();
                    handler.postDelayed(()->{if(token==generation&&stt!=null&&!finalDelivered.get()){stop();error("음성 입력 시간이 지났어요. 마이크를 눌러 다시 말씀해 주세요.");}},15000);
                });}
                @Override public void onFailure(ai.pleos.playground.stt.constant.ErrorType e){handler.post(()->{if(token==generation){stop();error("음성 엔진을 준비하지 못했어요. ("+e+")");}});}
            });
        }catch(Throwable e){stop();error("음성 입력을 시작하지 못했어요.");}
    }
    void speak(String text) {
        if(text==null||text.length()>1000)return;stop();final int token=++generation;if(!focus(token))return;
        try{tts=new TextToSpeech(context,ai.pleos.playground.tts.constant.Mode.ON_DEVICE);
            tts.initialize(new ai.pleos.playground.tts.listener.OnInitializeListener(){
                @Override public void onSuccess(){handler.post(()->{if(token!=generation||tts==null)return;tts.setLocale(Locale.KOREA);tts.setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ASSISTANT).setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build());tts.addEventListener(new ai.pleos.playground.tts.listener.EventListener(){
                    @Override public void onReady(){}
                    @Override public void onStart(){Log.i("PleorderSpeech","TTS_STARTED");}
                    @Override public void onDone(){if(token==generation){Log.i("PleorderSpeech","TTS_DONE");event("tts-done","done",true);abandon();}}
                    @Override public void onStop(){}
                    @Override public void onUpdatedRms(double rms){}
                    @Override public void onError(ai.pleos.playground.tts.constant.ErrorType e){if(token==generation){Log.w("PleorderSpeech","TTS_ERROR "+e);abandon();}}
                });tts.speak(text,true);});}
                @Override public void onFailure(ai.pleos.playground.tts.constant.ErrorType e){if(token==generation){Log.w("PleorderSpeech","TTS_INIT_ERROR "+e);abandon();}}
            });
        }catch(Throwable e){abandon();}
    }
    private void abandon(){if(focus!=null){audio.abandonAudioFocusRequest(focus);focus=null;}}
    private void clearStt(){
        SpeechToText previous=stt;ai.pleos.playground.stt.listener.ResultListener listener=sttListener;
        stt=null;sttListener=null;
        if(previous==null)return;
        try{if(listener!=null)previous.removeListener(listener);}catch(Throwable ignored){}
        try{previous.stop();}catch(Throwable ignored){}
        try{previous.release();}catch(Throwable ignored){}
    }
    void stop(){generation++;handler.removeCallbacksAndMessages(null);clearStt();if(tts!=null){try{tts.stop();}catch(Throwable ignored){}try{tts.release();}catch(Throwable ignored){}tts=null;}abandon();event("speech-end","ended",true);}
}

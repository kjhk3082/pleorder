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
    private boolean focus() {
        focus=new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
            .setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ASSISTANT).setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build())
            .setOnAudioFocusChangeListener(change->{if(change<0)stop();},handler).build();
        return audio.requestAudioFocus(focus)==AudioManager.AUDIOFOCUS_REQUEST_GRANTED;
    }
    void listen(byte[] pcm) {
        stop();if(!focus()){error("다른 오디오가 사용 중이에요. 잠시 후 다시 말해 주세요.");return;}
        final int token=++generation;
        final AtomicBoolean finalDelivered=new AtomicBoolean(false);
        try {
            stt=new SpeechToText(context,ai.pleos.playground.stt.constant.Mode.ON_DEVICE);
            stt.initialize(new ai.pleos.playground.stt.listener.OnInitializeListener(){
                @Override public void onSuccess(){handler.post(()->{
                    if(token!=generation||stt==null)return;
                    stt.setLocale(Locale.KOREA);
                    sttListener=new ai.pleos.playground.stt.listener.ResultListener(){
                        @Override public void onReady(){if(token==generation)event("speech-ready","ready",true);}
                        @Override public void onStartedRecognition(){Log.i("PleorderSpeech","STT_STARTED");}
                        @Override public void onUpdated(String text,boolean complete){
                            if(token!=generation||finalDelivered.get())return;
                            if(complete&&!finalDelivered.compareAndSet(false,true))return;
                            if(text==null||text.trim().isEmpty()){
                                if(complete){error("말씀을 듣지 못했어요. 마이크를 누르고 다시 말씀해 주세요.");abandon();}
                                return;
                            }
                            try{sink.accept(new JSONObject().put("type","speech-result").put("text",text).put("final",complete));Log.i("PleorderSpeech","STT_RESULT final="+complete);}catch(Exception ignored){}
                        }
                        @Override public void onUpdatedEpdData(long on,long off){}
                        @Override public void onUpdatedRms(double rms){}
                        @Override public void onEndedRecognition(){if(token==generation){event("speech-end","ended",true);abandon();}}
                        @Override public void onError(ai.pleos.playground.stt.constant.ErrorType e){if(token==generation){Log.w("PleorderSpeech","STT_ERROR "+e);error("잘 듣지 못했어요. 마이크를 누르고 다시 말해 주세요. ("+e+")");abandon();}}
                    };
                    stt.addListener(sttListener);
                    if(pcm!=null){stt.sendAudio(pcm);stt.completeAudioSend();}else stt.request();
                    handler.postDelayed(()->{if(token==generation&&stt!=null)stt.stop();},15000);
                });}
                @Override public void onFailure(ai.pleos.playground.stt.constant.ErrorType e){if(token==generation){error("음성 엔진을 준비하지 못했어요. ("+e+")");abandon();}}
            });
        }catch(Throwable e){error("음성 입력을 시작하지 못했어요.");abandon();}
    }
    void speak(String text) {
        if(text==null||text.length()>1000)return;stop();if(!focus())return;final int token=++generation;
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
    void stop(){generation++;handler.removeCallbacksAndMessages(null);if(stt!=null){try{if(sttListener!=null)stt.removeListener(sttListener);stt.stop();stt.release();}catch(Throwable ignored){}stt=null;sttListener=null;}if(tts!=null){try{tts.stop();tts.release();}catch(Throwable ignored){}tts=null;}abandon();event("speech-end","ended",true);}
}

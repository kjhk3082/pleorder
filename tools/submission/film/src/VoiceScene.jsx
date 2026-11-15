import React from "react";
import {useCurrentFrame} from "remotion";
import {at, Captions, digits, Header, Headline, ink, Label, lightMint, Panel, Surface} from "./shared";

function Sound({frame,scene,input}){
  const color=input?"#F5C887":lightMint;
  return <svg width="490" height="88" viewBox="0 0 490 88">
    {Array.from({length:61},(_,i)=>{
      const sample=scene.envelope[Math.max(0,frame-(60-i))]||0;
      const height=4+Math.min(1,sample*6)*75;
      return <rect key={i} x={i*8} y={(86-height)/2} width="4" height={height} rx="2" fill={color} opacity={.23+i*.012}/>;
    })}
  </svg>;
}
export function VoiceScene({scene}){
  const f=useCurrentFrame(), shot=scene.shots.find(s=>f>=s.at&&f<s.at+s.frames)||scene.shots[0];
  const input=shot.speaker==="in",phase=shot.turn;
  const lines=input ? {order:["“비빔밥 한 개","배달해 줘.”"],approve:["“결제 승인.”"],status:["“주문 상태","알려 줘.”"]}[phase]
                    : {order:["주문을","확인해요."],approve:["12,500원","모의 결제."],status:["매장에서","조리 중."]}[phase];
  return <Surface dark theme="#082B3E">
    <Header dark note="공개 Pleos STT·TTS  /  debug 녹화"/>
    <div style={at(95,208)}><Label dark color={input?"#F5C887":lightMint}>{input?"시험 음성 입력":"차량 SDK 응답"}</Label></div>
    <div style={at(88,304,{width:615})}><Headline key={phase+shot.speaker} lines={lines} begin={shot.at} size={input?75:88} color="#F5F9F3"/></div>
    <div style={at(98,630)}><Sound frame={f} scene={scene} input={input}/></div>
    <div style={at(99,754,{display:"flex",gap:27,alignItems:"center",fontSize:29,fontWeight:650,letterSpacing:-1,color:"#92AEB8"})}>
      {["주문","승인","현황"].map((s,i)=><React.Fragment key={s}>{i>0&&<span style={{height:2,width:30,background:"#547580"}}/>}<span style={{color:phase===["order","approve","status"][i]?lightMint:"#B7C8C9"}}>{s}</span></React.Fragment>)}
    </div>
    <Panel scene={scene} dark foot="합성 입력 · 에뮬레이터 스피커 원음  /  발췌"/>
    <Captions scene={scene} dark/>
  </Surface>;
}

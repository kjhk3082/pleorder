import React from "react";
import {Img, staticFile, useCurrentFrame} from "remotion";
import {at, Captions, digits, ease, Header, Headline, ink, Label, lightMint, linen, Mark, mint, night, Surface} from "./shared";

const road="M-80 810 C180 810 285 810 400 810 S579 725 679 725 H750 C865 725 881 837 1013 837 H1287 C1360 837 1370 790 1430 790 H2060";

export function Intro({scene}){
  const f=useCurrentFrame(), p=ease(f,12,211), reveal=ease(f,169,197), second=f>=180;
  return <Surface theme="#F4EFE6">
    <div style={at(720,0,{width:1320,height:950,overflow:"hidden",maskImage:"linear-gradient(to right,transparent,black 22%)",WebkitMaskImage:"linear-gradient(to right,transparent,black 22%)"})}>
      <Img src={staticFile("bibimbap.png")} style={{width:"100%",height:"100%",objectFit:"cover",transform:`scale(${1.10-.075*ease(f,162,330)})`}}/>
    </div>
    {reveal<1 && <div style={at(0,0,{width:1920,height:1080,opacity:1-reveal,overflow:"hidden"})}>
      <Img src={staticFile("drive-home.jpg")} style={{width:"100%",height:"100%",objectFit:"cover", transform:`scale(${1.015+.065*ease(f,0,192)})`, transformOrigin:"73% 59%"}}/>
      <div style={{position:"absolute",inset:0,background:"linear-gradient(0deg,#071B2AC7 0%,transparent 40%),linear-gradient(90deg,#0417247A,transparent 67%)"}}/>
    </div>}
    <svg width="1920" height="940" style={at(0,0,{opacity:.6+.4*reveal})} viewBox="0 0 1920 940" fill="none">
      <path d={road} stroke={second?"#9DAFA4":"#94A9A3"} strokeOpacity=".38" strokeWidth="2"/>
      <path d={road} stroke={second?"#168E82":"#86E4CD"} strokeWidth="5" pathLength="1" strokeDasharray={p*.63+" 1"} strokeLinecap="round"/>
      <circle cx="401" cy="810" r="7" fill={second?"#168E82":lightMint}/><circle cx="679" cy="725" r="6" fill={second?"#168E82":lightMint}/>
    </svg>
    <Header dark={!second} note="Pleos Connect  /  차량용 주문 시뮬레이터"/>
    <div style={at(99,212)}><Label dark={!second}>퇴근길 저녁</Label></div>
    <div style={at(87,288)}>{second
      ?<Headline key="arrive" begin={180} size={127} lines={["도착에 맞춘","한 끼."]}/>
      :<Headline key="question" size={122} color="#FCFAEF" lines={["누가 먼저","도착할까요?"]}/>}</div>
    <div style={at(100,696,{fontSize:30,fontWeight:540,color:second?"#375C61":"#CADBD8",letterSpacing:-1})}>{second?"차의 도착 예정 시각에 맞춰 매장에 전송":"퇴근하는 나, 집으로 가는 저녁."}</div>
    <Captions scene={scene} dark={!second}/>
  </Surface>;
}
export function Outro({scene}){
  const f=useCurrentFrame(),p=ease(f,2,63),lg=ease(f,34,61);
  const tipX=1450+(1003-1450)*p,tipY=835+(467-835)*p;
  return <Surface dark>
    <Header dark note="주문·결제 시뮬레이션  /  Pleos Connect"/>
    <svg width="1920" height="950" style={at(0,0)} viewBox="0 0 1920 950" fill="none">
      <path d="M-130 758 H320 C470 758 479 644 607 644 H711" stroke="#255264" strokeWidth="3"/>
      <path d="M1205 710 H1320 C1448 710 1475 830 1640 830 H2035" stroke="#396A73" strokeWidth="3"/>
      <path d="M1205 710 H1320 C1448 710 1475 830 1640 830 H2035" stroke={lightMint} strokeWidth="5" pathLength="1" strokeDasharray={ease(f,48,158)+" 1"}/>
    </svg>
    <div style={at(827,293,{transform:`translateY(${(1-lg)*12}px)`,opacity:.2+.8*lg})}><Mark size={260} color="#F4F8F1" hideDot/></div>
    <div style={at(tipX,tipY,{width:38,height:38,borderRadius:40,background:mint,opacity:.25+.75*ease(f,0,14)})}/>
    <div style={at(0,539,{right:0,textAlign:"center",fontSize:113,fontWeight:850,letterSpacing:-9,color:"#F4F8F1"})}>플레오더</div>
    <div style={at(0,721,{right:0,textAlign:"center",fontSize:35,fontWeight:510,letterSpacing:-1.1,color:"#B9D3D5"})}>도착에 맞춘 배달과 픽업</div>
    <Captions scene={scene} dark/>
  </Surface>;
}

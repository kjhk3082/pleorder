import React from "react";
import {Img, staticFile, useCurrentFrame} from "remotion";
import {at, Captions, digits, ease, Header, Headline, ink, Label, lightMint, linen, mint, Panel, RouteLine, Surface} from "./shared";

function Chapter({scene,dark=false,theme,note,context,head,begin=0,size=83,foot,children}){
  return <Surface dark={dark} theme={theme}>
    <Header dark={dark} note={note}/>
    <div style={at(92,219)}><Label dark={dark}>{context}</Label></div>
    <div style={at(86,307,{width:600})}><Headline key={head.join("")} lines={head} begin={begin} size={size} color={dark?"#F5F7EE":ink}/></div>
    {children}<Panel scene={scene} foot={foot} dark={dark}/><Captions scene={scene} dark={dark}/>
  </Surface>;
}
export function Explore({scene}){
  const f=useCurrentFrame(), route=f>=94;
  return <Chapter scene={scene} theme="#EAF1EB" context="목적지로 찾기" note="Pleos Connect  /  주차 중 매장 탐색"
    head={route?["가는 길에","들러서 픽업."]:["집 근처에서","배달받기."]} begin={route?94:0}
    foot="에뮬레이터 화면  ·  지도 © NAVER Corp.">
    <div style={at(98,644)}><RouteLine phase={route?1:0} labels={["출발지","매장","목적지"]}/></div>
  </Chapter>;
}

export function Decline({scene}){
  const f=useCurrentFrame(),retry=f>=248;
  return <Chapter scene={scene} theme="#F4EEE6" context="다른 카드로 결제" note="Pleos Connect  /  모의 결제"
    head={retry?["다른 카드로","다시 승인."]:["한도가","부족하면?"]} begin={retry?248:0}
    foot="에뮬레이터 화면  ·  테스트 카드">
    <div style={at(96,629,{width:495,borderTop:"2px solid #C2C8BF",paddingTop:18})}>
      <div style={{fontSize:24,color:"#536D71",fontWeight:570}}>모의 결제 금액</div>
      <div style={{fontSize:76,letterSpacing:-3,fontFamily:digits,fontWeight:600,lineHeight:1.35}}>12,500<span style={{fontSize:36,marginLeft:8}}>원</span></div>
    </div>
  </Chapter>;
}

export function Traffic({scene}){
  const f=useCurrentFrame(),change=ease(f,143,178),adjust=ease(f,248,284),done=f>=435;
  const x=172+200*change;
  return <Surface dark theme="#103B3D">
    <Header dark note="도착 맞춤 예약  /  시험용 ETA · 시계 가속"/>
    <div style={at(94,197)}><Label dark>퇴근길 정체</Label></div>
    <div style={at(89,276,{fontSize:66,letterSpacing:-4.5,fontWeight:800})}>집에 도착하기까지</div>
    <div style={at(89,365,{fontFamily:digits,fontWeight:650,fontSize:168,letterSpacing:-9,lineHeight:1,color:"#FCF2DD"})}>{Math.round(60+change*15)}<span style={{fontFamily:"inherit",fontSize:49,letterSpacing:-3,marginLeft:9}}>분</span></div>
    <svg width="520" height="95" style={at(99,572)} viewBox="0 0 520 95">
      <path d="M0 51 H475" stroke="#517375" strokeWidth="3"/>
      {[8,48,88,128,168,208,248,288,328,368,408,448].map(i=><path key={i} d={`M${i} 41 v20`} stroke="#75918C" strokeWidth="2"/>)}
      <path d={`M172 51 H${x}`} stroke={lightMint} strokeWidth="7"/>
      <circle cx="172" cy="51" r="6" fill="#E7D7AF"/><circle cx={x} cy="51" r="12" fill={lightMint}/>
    </svg>
    <div style={at(99,695,{width:505,borderTop:"1px solid #67847E",paddingTop:19})}>
      <div style={{fontSize:24,color:"#B6CECA",fontWeight:550}}>매장에 보내는 시점</div>
      <div style={{fontSize:48,fontWeight:740,letterSpacing:-2,color:adjust>0?lightMint:"#F4F2E8"}}>{done?"전송 1회 · 결제 1회":adjust>0?"15분 늦게":"전송 대기"}</div>
    </div>
    <Panel scene={scene} dark foot="예약 상태 실제 화면  ·  지도 © NAVER Corp."/><Captions scene={scene} dark/>
  </Surface>;
}

export function Door({scene}){
  const f=useCurrentFrame(), zoom=ease(f,116,136);
  return <Surface theme="#F6F2E9">
    <Header note="Pleos Connect  /  배달 추적"/>
    <div style={at(93,220)}><Label>배달 완료</Label></div>
    <div style={at(87,298)}><Headline lines={["문 앞까지","확인했어요."]}/></div>
    <div style={at(96,621,{width:482,borderTop:"1.5px solid #AFC2B7",paddingTop:22})}>
      <div style={{fontSize:27,fontWeight:560,color:"#385F60",letterSpacing:-1}}>배달 완료 시각</div>
      <div style={{fontFamily:digits,fontSize:93,fontWeight:600,color:ink,letterSpacing:-4}}>04:02</div>
    </div>
    <Panel scene={scene} foot="에뮬레이터 화면  ·  시뮬레이션 배달"/>
    {zoom>0 && <div style={at(692,172,{width:1136,height:719,background:"#FAF9F4",boxShadow:"0 14px 33px #263B421D",borderRadius:12,padding:16,boxSizing:"border-box",clipPath:`inset(${(1-zoom)*100}% 0 0 0)`,transform:`rotate(${-.8*zoom}deg)`})}>
      <div style={{height:609,borderRadius:5,overflow:"hidden"}}><Img src={staticFile("delivery-proof.png")} style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"center 55%",transform:`scale(${1.03+.03*ease(f,135,257)})`}}/></div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",height:75,padding:"0 14px",fontSize:29,fontWeight:620,color:ink}}><span>문 앞에 놓아드렸어요</span><span style={{fontSize:23,color:"#466368"}}>앱에 표시한 예시 사진</span></div>
    </div>}
    <Captions scene={scene}/>
  </Surface>;
}

export function Pickup({scene}){
  const f=useCurrentFrame(),atStore=f>=287,food=1-ease(f,107,131);
  return <Chapter scene={scene} theme="#E9F1EA" context="매장 픽업" note="Pleos Connect  /  가는 길 수령"
    head={atStore?["준비 완료.","이제 수령."]:["가는 길에","치킨 픽업."]} begin={atStore?287:0}
    foot={atStore?"시뮬레이션 수령  ·  시험 시계 가속":food>.5?"앱 메뉴 이미지":"내비게이션 경유지 전송 확인창"}>
    <div style={at(98,651)}><RouteLine phase={atStore?1:0} labels={["현재 위치","치킨 매장","목적지"]}/></div>
    {food>0 && <div style={at(695,175,{zIndex:2,width:1132,height:708,borderRadius:26,overflow:"hidden",clipPath:`inset(0 0 0 ${(1-food)*100}%)`})}>
      <Img src={staticFile("chicken.png")} style={{width:"100%",height:"100%",objectFit:"cover",transform:`scale(${1.015+.065*ease(f,0,128)})`}}/>
    </div>}
  </Chapter>;
}
export function Driving({scene}){
  const f=useCurrentFrame();
  return <Surface dark theme="#101F30">
    <Header dark note="Pleos Connect  /  release 0.2.1"/>
    <div style={at(90,155,{display:"flex",alignItems:"center",gap:30})}><Label dark>주행 화면</Label>
      <span style={{fontSize:30,color:"#CDDCDA",fontWeight:550,letterSpacing:-.7}}>{f<108?"P단에서 D단으로":"D단 · 시속 30km 시험"}</span></div>
    <Panel scene={scene} rect={[240,223,1440,700]} bg="#182A39" dark/>
    <Captions scene={scene} dark/>
  </Surface>;
}

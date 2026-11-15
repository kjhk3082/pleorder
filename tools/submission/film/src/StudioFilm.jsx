import React, {useEffect, useState} from "react";
import {AbsoluteFill, Audio, continueRender, delayRender, Easing, Img, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame} from "remotion";

const paper="#f5f5f7", ink="#131820", dim="#5c6770", mint="#00786f", ice="#82e5d5", night="#10161d";
const font='"Pleorder Film","Malgun Gothic",sans-serif';
const pos=(left,top,rest={})=>({position:"absolute",left,top,...rest});
const ease=(f,a,b)=>interpolate(f,[a,b],[0,1],{easing:Easing.bezier(.22,1,.36,1),extrapolateLeft:"clamp",extrapolateRight:"clamp"});
const img={width:"100%",height:"100%",display:"block",objectFit:"cover"};
let fontLoad;
export function Typeface(){
  const [handle]=useState(()=>delayRender("Loading the product typeface"));
  useEffect(()=>{
    fontLoad??=new FontFace("Pleorder Film","url("+staticFile("PretendardVariable.woff2")+")",{weight:"100 900"}).load()
      .then(face=>document.fonts.add(face));
    fontLoad.then(()=>continueRender(handle)).catch(()=>continueRender(handle));
  },[handle]);
  return null;
}
export function Brand({size=66,light=false}){
  // The approved Android and web mark has a square canvas. Both layers share that canvas.
  return <span style={{display:"inline-block",width:size,height:size,position:"relative",flex:"0 0 auto"}}>
    <Img src={staticFile("brand.png")} style={{...img,objectFit:"contain"}}/>
    {light && <Img src={staticFile("brand.png")} style={{...img,objectFit:"contain",position:"absolute",inset:0,filter:"brightness(0) invert(1)",clipPath:"polygon(0 0,100% 0,100% 65%,64.5% 65%,64.5% 100%,0 100%)"}}/>}
  </span>;
}
function Lockup({width,light=false}){
  const art={...img,objectFit:"contain",position:"absolute",inset:0};
  return <span style={{display:"block",position:"relative",width,aspectRatio:"1185 / 438"}}>
    <Img src={staticFile("lockup.png")} style={{...art,filter:light?"brightness(0) invert(1)":"none"}}/>
    {light&&<Img src={staticFile("lockup.png")} style={{...art,clipPath:"inset(68.9% 71.4% 13.5% 22%)"}}/>}
  </span>;
}
export function Cover(){
  return <AbsoluteFill style={{background:"#061b29",fontFamily:font,color:"#f7fafb",overflow:"hidden"}}>
    <Typeface/>
    <Img src={staticFile("drive-home.jpg")} style={{...img,position:"absolute",objectPosition:"50% 53%"}}/>
    <AbsoluteFill style={{background:"linear-gradient(90deg,#041a29 0%,rgba(4,26,41,.94) 23%,rgba(4,26,41,.68) 46%,rgba(4,26,41,.13) 78%)"}}/>
    <div style={pos(75,36)}><Lockup width={230} light/></div>
    <div style={pos(78,165,{fontSize:88,letterSpacing:-5.4,lineHeight:1.23,fontWeight:780})}>퇴근길에 주문하고,<br/><span style={{color:"#a0e9dd"}}>도착해서 먹어요.</span></div>
    <div style={pos(80,459,{fontSize:31,fontWeight:480,letterSpacing:-.85,color:"#ddeded"})}>집으로 배달　/　가는 길에 픽업</div>
  </AbsoluteFill>;
}
function Word({children,frame=0,size=100,color=ink}){
  const p=ease(frame,0,20);
  return <div style={{fontSize:size,lineHeight:1.055,letterSpacing:"-.058em",fontWeight:760,color,transform:"translateY("+((1-p)*26)+"px)",opacity:.17+.83*p,whiteSpace:"pre-line"}}>{children}</div>;
}
function Caption({scene,dark=false}){
  const f=useCurrentFrame(),c=scene.cues.find(x=>f*1000/30>=x.startMs && f*1000/30<x.endMs);
  if(!c)return null;
  const speaker=c.role==="driver"?"운전자":c.role==="system"?"차량 응답":"";
  return <div style={{position:"absolute",left:80,right:80,bottom:33,display:"flex",justifyContent:"center"}}>
    <div style={{display:"flex",alignItems:"center",gap:18,borderRadius:32,padding:"12px 29px",background:dark?"#0b111beF":"#fffffff1",color:dark?"#f9fafb":ink,fontSize:34,fontWeight:550,letterSpacing:"-.035em",lineHeight:1.27,maxWidth:1730,textAlign:"center",boxShadow:"0 2px 12px #1119220b"}}>
      {speaker&&<b style={{color:dark?ice:mint,fontSize:24,whiteSpace:"nowrap"}}>{speaker}</b>}{c.text}
    </div>
  </div>;
}
function Screen({scene,frame,rect,light=false,fit="contain",delay=0}){
  const p=ease(frame,delay,delay+26);
  const currentFrame=useCurrentFrame(),index=Math.max(0,scene.clips.findIndex(c=>currentFrame>=c.at && currentFrame<c.at+c.frames));
  const aspect=scene.clips[index]?.aspect||16/9,previous=scene.clips[Math.max(0,index-1)]?.aspect||aspect;
  const resize=ease(currentFrame,scene.clips[index]?.at||0,(scene.clips[index]?.at||0)+13);
  const ratio=previous+(aspect-previous)*resize,width=Math.min(rect[2],rect[3]*ratio),height=width/ratio;
  return <div style={pos(rect[0]+(rect[2]-width)/2,rect[1]+(rect[3]-height)/2,{width,height,borderRadius:scene.layout==="field"?24:28,background:light?"#e9eced":"#11171e",overflow:"hidden",
    border:"2px solid "+(light?"#ffffff":"#3c454d"),boxShadow:light?"0 20px 48px #17253123":"0 24px 65px #00000044",boxSizing:"border-box",transformOrigin:"50% 85%",transform:"perspective(2400px) translateY("+((1-p)*28)+"px) rotateX("+((1-p)*4)+"deg) scale("+(.981+.019*p)+")"})}>
    {scene.clips.map((c,i)=><Sequence key={i} from={c.at} durationInFrames={c.frames} layout="none">
      <OffthreadVideo src={staticFile(c.file)} muted style={{...img,position:"absolute",inset:0,objectFit:resize<1?"cover":fit}}/>
    </Sequence>)}
  </div>;
}
function Tag({children,dark=false}){
  return <div style={{display:"flex",alignItems:"center",gap:13,color:dark?ice:mint,fontSize:29,fontWeight:650,letterSpacing:"-.029em"}}><span style={{width:9,height:9,borderRadius:"50%",background:"currentColor"}}/>{children}</div>;
}
function VoiceBars({scene,frame}){
  const values=Array.from({length:43},(_,i)=>scene.env[Math.max(0,frame-42+i)]||0);
  return <svg width="320" height="55" viewBox="0 0 320 55">{values.map((v,i)=>{const h=4+Math.min(1,v*7)*46;return <rect key={i} x={i*7.4} y={(55-h)/2} width="3.8" height={h} rx="1.9" fill={ice} opacity={.26+.74*i/42}/>;})}</svg>;
}
function Route({frame}){
  const pct=ease(frame,5,63),path="M9 41 H113 C155 41 145 14 188 14 H221 C260 14 248 41 290 41 H408";
  return <div style={{width:420}}><svg width="420" height="60">
    <path d={path} fill="none" stroke="#c7cecf" strokeWidth="4"/>
    <path d={path} fill="none" stroke={mint} strokeLinecap="round" strokeWidth="5" pathLength="1" strokeDasharray={pct+" 1"}/>
    {[[9,41],[209,14],[408,41]].map(([x,y],i)=><circle key={x} cx={x} cy={y} r={i===1?7:5} fill={mint}/>)}
  </svg><div style={{display:"flex",justifyContent:"space-between",color:dim,fontSize:23,fontWeight:560}}><span>출발</span><span>픽업</span><span>목적지</span></div></div>;
}
function TitleScene({scene}){
  const f=useCurrentFrame();
  const intro=scene.layout==="opening",outro=scene.layout==="closing",nightShot=intro&&f<Math.round(scene.frames*.53);
  const reveal=ease(f,Math.round(scene.frames*.5),Math.round(scene.frames*.5)+16);
  if(outro)return <AbsoluteFill style={{background:paper,color:ink,alignItems:"center",justifyContent:"center",paddingBottom:80}}>
    <div style={{transform:"translateY("+((1-ease(f,0,26))*28)+"px)"}}><Lockup width={588}/></div>
    <div style={{fontSize:42,letterSpacing:"-.044em",fontWeight:540,color:dim,marginTop:22}}>도착에 맞춘 배달과 픽업</div><Caption scene={scene}/>
  </AbsoluteFill>;
  return <AbsoluteFill style={{background:"#f2eee9",overflow:"hidden"}}>
    <Img src={staticFile("bibimbap.png")} style={pos(767,-135,{width:1350,height:1320,objectFit:"cover",maskImage:"linear-gradient(90deg,transparent,#000 24%)",transform:"scale("+(1.07-.045*ease(f,75,210))+")"})}/>
    <AbsoluteFill style={{opacity:1-reveal}}>
      <Img src={staticFile("drive-home.jpg")} style={{...img,transform:"scale("+(1.006+.054*ease(f,0,180))+")"}}/>
      <AbsoluteFill style={{background:"linear-gradient(90deg,#06131eea,rgba(5,18,28,.60) 32%,transparent 79%),linear-gradient(0deg,#06131e70,transparent 36%)"}}/>
    </AbsoluteFill>
    <div style={pos(94,77,{display:"flex",alignItems:"center",gap:8,fontSize:31,fontWeight:700,color:nightShot?"white":ink})}><Brand size={60} light={nightShot}/>플레오더</div>
    <div style={pos(102,358)} key={nightShot?"road":"meal"}><Word frame={nightShot?f:Math.max(0,f-Math.round(scene.frames*.53))} size={139} color={nightShot?"#fcfcfe":ink}>{nightShot?"오늘 저녁,\n누가 먼저 도착할까?":"도착에 맞춘\n한 끼."}</Word></div>
    <Caption scene={scene} dark={nightShot}/>
  </AbsoluteFill>;
}
function Spotlight({scene}){
  const f=useCurrentFrame(),dark=scene.theme==="dark",food=scene.layout==="pickup"&&f<scene.reveal;
  const size=scene.title.length>17?70:83;
  if(food)return <AbsoluteFill style={{background:"#1a170f"}}>
    <Img src={staticFile("chicken.png")} style={{...img,objectPosition:"center 45%",transform:"scale("+(1.025+.042*ease(f,0,scene.reveal))+")"}}/>
    <AbsoluteFill style={{background:"linear-gradient(90deg,#11141bdd 0%,#11141b90 37%,transparent 76%)"}}/>
    <div style={pos(101,229)}><Tag dark>가는 길에 픽업</Tag></div><div style={pos(92,336)}><Word frame={f} size={141} color="white">{"오늘은,\n치킨 픽업."}</Word></div><Caption scene={scene} dark/>
  </AbsoluteFill>;
  const offset=scene.layout==="pickup"?scene.reveal:0;
  const title=scene.layout==="traffic"?"집까지 "+Math.round(60+15*ease(f,Math.round(scene.frames*.30),Math.round(scene.frames*.48)))+"분":scene.title;
  return <AbsoluteFill style={{background:dark?night:paper,color:dark?"white":ink}}>
    <div style={pos(95,49)}><Tag dark={dark}>{scene.label}</Tag></div>
    <div style={pos(90,105)}><Word frame={f-offset} size={size} color={dark?"#f7f9fa":ink}>{title}</Word></div>
    {scene.layout==="pickup"?<div style={pos(1410,66)}><Route frame={f-offset}/></div>:
      scene.note && <div style={pos(1130,119,{right:91,textAlign:"right",fontSize:31,fontWeight:530,letterSpacing:"-.035em",color:dark?"#bccecf":dim})}>{scene.note}</div>}
    <Screen scene={scene} frame={f-offset} rect={[134,237,1652,697]} fit="contain" light={!dark}/>
    <Caption scene={scene} dark={dark}/>
  </AbsoluteFill>;
}
function MicGlyph({size=64}){
  return <svg width={size} height={size} viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
    <rect x="17" y="4" width="14" height="25" rx="7"/><path d="M11 23a13 13 0 0 0 26 0M24 36v6m-7 0h14"/>
  </svg>;
}
function ConversationPanel({scene,frame}){
  const status=scene.panel==="status", request=scene.panel==="request", order=scene.order;
  const cueFrame=(needle)=>Math.round(scene.cues.find(c=>c.text.includes(needle))?.startMs*.03);
  const cooking=status && frame>=cueFrame("조리 중"), arrival=status && frame>=cueFrame("27분");
  const open=ease(frame,0,19), signal=scene.env[frame]||0;
  const panelStyle=pos(646,198,{width:1150,height:652,boxSizing:"border-box",borderRadius:43,overflow:"hidden",
    background:request?"#f2ece3":"linear-gradient(140deg,#f5faf8,#e3eeeb)",color:ink,padding:"57px 65px",
    boxShadow:"0 28px 68px #0004",transform:"translateY("+((1-open)*20)+"px)",letterSpacing:"-.036em"});
  const label={color:"#35675f",fontSize:27,fontWeight:650};
  if(request)return <div style={panelStyle}>
    <Img src={staticFile("chicken.png")} style={pos(510,-8,{width:700,height:675,objectFit:"cover",maskImage:"linear-gradient(90deg,transparent,#000 19%)",transform:"scale("+(1+.035*ease(frame,0,95))+")"})}/>
    <div style={{position:"relative"}}><span style={label}>운전자 발화</span>
      <div style={{fontSize:89,fontWeight:760,lineHeight:1.08,letterSpacing:"-.066em",marginTop:106}}>치킨 한 마리</div>
      <div style={{fontSize:47,fontWeight:550,color:"#40554e",marginTop:25}}>우리 집으로 배달</div>
      <div style={{display:"flex",gap:14,alignItems:"center",marginTop:122,fontSize:29,color:"#376359"}}><MicGlyph size={39}/>차량 음성 입력</div>
    </div>
  </div>;
  if(status)return <div style={panelStyle}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><span style={label}>차량 응답 요약</span><span style={{fontSize:29,fontWeight:560,color:"#546962"}}>{order.id}</span></div>
    <div style={{marginTop:53,fontSize:43,fontWeight:640}}>{order.store}</div>
    <div style={{display:"flex",gap:30,alignItems:"baseline",marginTop:14}}>
      <span style={{fontSize:86,lineHeight:1.2,fontWeight:760,letterSpacing:"-.068em",color:cooking?mint:ink}}>{cooking?"조리 중":"최근 주문"}</span>
      {arrival&&<span style={{fontSize:50,fontWeight:650,color:mint,opacity:ease(frame,cueFrame("27분"),cueFrame("27분")+10)}}>도착까지 {order.eta}</span>}
    </div>
    <div style={{display:"flex",marginTop:64,gap:11}}>{["주문 접수","조리","배달","완료"].map((stage,i)=><div key={stage} style={{flex:1,color:i<1||(cooking&&i===1)?mint:"#5b716c",fontSize:25,fontWeight:i===1?680:540}}>
      <div style={{height:7,borderRadius:5,background:i<1||(cooking&&i===1)?mint:"#c6d7d1",marginBottom:15}}/>{stage}</div>)}</div>
    <div style={{marginTop:58,borderTop:"1.5px solid #afc3bc",paddingTop:23,display:"flex",justifyContent:"space-between",fontSize:31,fontWeight:560}}><span>{order.method} · 모의 결제</span><strong>{order.total}</strong></div>
  </div>;
  return <div style={panelStyle}>
    <span style={label}>차량 음성 버튼</span>
    <div style={{marginTop:74,display:"flex",gap:31,alignItems:"center"}}>
      <div style={{width:139,height:139,borderRadius:42,background:"#d0e5de",color:mint,display:"grid",placeItems:"center",transform:"scale("+(1+Math.min(.11,signal*.48))+")"}}><MicGlyph size={78}/></div>
      <div style={{fontSize:94,fontWeight:730,letterSpacing:"-.06em"}}>Gleo</div>
      <svg width="102" height="43" viewBox="0 0 102 43"><path d="M4 22H92m-17-16 18 16-18 16" fill="none" stroke="#7fa59a" strokeWidth="4" strokeLinecap="round"/></svg>
      <Brand size={112}/><strong style={{fontSize:67,letterSpacing:"-.066em"}}>플레오더</strong>
    </div>
    <div style={{fontSize:48,lineHeight:1.35,color:"#22453f",fontWeight:570,marginTop:74}}>차량에서 주문할 메뉴와<br/>받을 곳을 말하세요.</div>
  </div>;
}
function Field({scene}){
  const f=useCurrentFrame(),active=scene.cues.find(x=>f*1000/30>=x.startMs&&f*1000/30<x.endMs);
  const showPanel=scene.panel==="invocation"||scene.panel==="status"||(scene.panel==="request"&&f<scene.clips[0].at);
  return <AbsoluteFill style={{background:"radial-gradient(ellipse at 78% 33%,#24343b 0%,#171e27 43%,#10151c 86%)",color:"white"}}>
    <div style={pos(90,67,{display:"flex",alignItems:"center",gap:12,fontSize:29,fontWeight:640,color:"#d6e0e3"})}><Brand size={52} light/>플레오더 <span style={{fontWeight:430,color:"#9ba8ad"}}>· 차량 Gleo 실기</span></div>
    <div style={pos(90,292)}><Tag dark>{scene.label}</Tag></div>
    <div style={pos(85,371,{width:515})}><Word frame={f} size={scene.titleSize||80} color="#f7f8fa">{scene.title}</Word></div>
    <div style={pos(92,677)}><VoiceBars scene={scene} frame={f}/></div>
    <div style={pos(93,753,{fontSize:25,fontWeight:530,color:"#afc2c6",letterSpacing:"-.03em"})}>{active?.role==="driver"?"운전자 마이크":active?.role==="system"?"에뮬레이터 스피커":scene.note}</div>
    {showPanel?<ConversationPanel scene={scene} frame={f}/>:<Screen scene={scene} frame={f} rect={[620,183,1215,697]} fit="contain"/>}
    <Caption scene={scene} dark/>
  </AbsoluteFill>;
}
function Scene({scene}){
  if(scene.layout==="opening"||scene.layout==="closing")return <TitleScene scene={scene}/>;
  if(scene.layout==="field")return <Field scene={scene}/>;
  return <Spotlight scene={scene}/>;
}
export function StudioFilm({cut}){
  return <AbsoluteFill style={{fontFamily:font,background:paper}}>
    <Typeface/>
    {cut.scenes.map((s,i)=><Sequence key={i} name={s.label||s.title} from={s.from} durationInFrames={s.frames}><Scene scene={s}/></Sequence>)}
    <Audio src={staticFile(cut.master)}/>
  </AbsoluteFill>;
}

import React from "react";
import {AbsoluteFill, Img, OffthreadVideo, Sequence, staticFile, useCurrentFrame} from "remotion";
import {Brand, Typeface} from "./StudioFilm";

const mint = "#a0ffe1";
const gold = "#ffe074";
const full = {width:"100%", height:"100%", display:"block", objectFit:"cover"};
const place = (left, top, rest = {}) => ({position:"absolute",left,top,...rest});
const photo = (at, file, zoom = 1, anchor = "50% 50%") => ({at,type:"photo",file,zoom,anchor});
const stock = (at, file, trim, zoom = 1) => ({at,type:"stock",file,trim,zoom});
const screen = (at, file, zoom, fit = "contain", trim = 0) => ({at,type:"screen",file,zoom,fit,trim});

// Cut positions are local to the line readings. The real display is photographed head-on
// so a single camera transform can move the trim, the screen recording and its bezel together.
function shots(scene) {
  switch (scene.id) {
    case "hook": return [
      stock(0,"sauce",39,1.08), photo(14,"door",1.08,"60% 46%"),
      photo(31,"traffic",1.12,"50% 63%"), photo(48,"bite",1.09,"42% 48%"),
      photo(84,"door",1.22,"68% 55%"), stock(118,"seoul",44,1.04)];
    case "idea": return [photo(0,"wheel",1.04,"32% 48%"), screen(34,scene.clip,1.06,"cover")];
    case "order": return [photo(0,"wheel",1.24,"26% 44%"),stock(49,"sauce",88,1.11)];
    case "quote": return [
      screen(0,scene.estimate,1.10), screen(58,scene.estimate,1.28,"contain",18),
      photo(97,"wheel",1.09,"42% 54%"), screen(140,scene.estimate,1.30),
      screen(180,scene.clip,1.27,"cover",5)];
    case "status": return [
      photo(0,"traffic",1.06),stock(33,"seoul",120,1.05),
      stock(63,"sauce",141,1.04), photo(115,"bite",1.17,"45% 43%"),
      stock(162,"seoul",155,1.19)];
    case "traffic": return [
      stock(0,"seoul",12), screen(50,scene.beforeDelay,1.10,"cover"),
      photo(93,"traffic",1.16,"40% 62%"), stock(147,"seoul",168,1.14),
      screen(182,scene.clip,1.18,"cover",33), screen(233,scene.clip,1.43,"cover",87)];
    case "pickup": return [stock(0,"seoul",119,1.16),screen(44,scene.clip,1.11),screen(94,scene.clip,1.38,"contain",20)];
    case "finish": return [
      photo(0,"door",1.10,"50% 40%"),photo(33,"bite",1.08,"50% 40%"),
      stock(65,"sauce",176,1.04),photo(103,"bite",1.08,"46% 48%"),stock(131,"sauce",24,1.08)];
    default: throw new Error("Unknown reel scene: "+scene.id);
  }
}

function Lens({shot}) {
  const f=useCurrentFrame();
  const sway = Math.sin(f/19)*2.3;
  const zoom = (shot.zoom || 1) * (1.016+Math.min(f,80)*.00052);
  const camera={position:"absolute",inset:0,transformOrigin:shot.anchor || (shot.type==="screen"?"50% 45%":"50% 50%"),
    transform:"translate("+sway+"px,"+Math.sin(f/23+.55)*1.9+"px) scale("+zoom+")"};
  if(shot.type==="screen") {
    return <div style={camera}>
      <Img src={staticFile("reel/dash.jpg")} style={full}/>
      <div style={place(59,668,{width:962,height:418,overflow:"hidden",borderRadius:10,background:"#eaf0f1"})}>
        <OffthreadVideo muted startFrom={shot.trim} src={staticFile(shot.file)}
          style={{...full,objectFit:shot.fit,objectPosition:"50% 48%"}}/>
        <AbsoluteFill style={{background:"linear-gradient(125deg,#fbfcff0c,transparent 40%,#202d4009)",boxShadow:"inset 0 0 5px #07101874"}}/>
      </div>
    </div>;
  }
  return <div style={camera}>{shot.type==="stock"
    ? <OffthreadVideo muted startFrom={shot.trim} src={staticFile("reel/"+shot.file+".mp4")} style={full}/>
    : <Img src={staticFile("reel/"+shot.file+".jpg")} style={full}/>}</div>;
}

const displayText = {
  "합계 26,000원이에요.":"합계 26,000원이에요.",
  "이만 육천 원?":"26,000원?",
  "배달 도착까지 약 27분 남았어요.":"배달 도착까지\n약 27분 남았어요.",
  "다음 날엔 도착할 때 맞춰 예약했어요.":"다음 날엔 도착할 때 맞춰\n예약했어요.",
  "칠십오 분?":"75분?",
  "십오 분 늦춰 주더라고요.":"15분 늦춰 주더라고요.",
};
const highlights = ["먼저 퇴근","강변북로","26,000원","27분","75분","15분","거의 동점","쏙","승인"];
const outline = {WebkitTextStroke:"5px #18191c",paintOrder:"stroke fill",textShadow:"0 4px 4px #000a, 0 8px 23px #0006"};

function Subtitles({scene,frame}) {
  const now=frame*1000/30;
  // Hold a caption across a short breath, replacing it on the next spoken syllable.
  const cue=scene.cues.find((c,i)=>now>=c.startMs-34 && now<Math.min(c.endMs+115,scene.cues[i+1]?.startMs ?? Infinity));
  if(!cue || (scene.id==="finish" && cue.text==="플레오더."))return null;
  const value=displayText[cue.text] || cue.text;
  const marked=highlights.find(word=>value.includes(word));
  const idx=marked?value.indexOf(marked):-1;
  const emphasis=cue.text==="칠십오 분?" || cue.text==="거의 동점이요." || cue.text==="이만 육천 원?";
  const elapsed=Math.max(0,(now-cue.startMs)/1000*30);
  const pop=emphasis?1+.075*Math.exp(-elapsed/4)*Math.sin(elapsed/2):1;
  const role=cue.role==="system"?"Gleo 실기 음성":cue.role==="driver"?"운전자 음성":"";
  return <div style={place(66,scene.id==="finish"?1225:1248,{width:900,textAlign:"center",whiteSpace:"pre-line",
    transform:"scale("+pop+")",transformOrigin:"50% 50%",fontWeight:820,lineHeight:1.19,letterSpacing:"-.042em"})}>
    {role&&<div style={{...outline,color:mint,fontSize:31,letterSpacing:"-.015em",marginBottom:11,fontWeight:720}}>{role}</div>}
    <span style={{...outline,color:"white",fontSize:emphasis?106:68}}>
      {idx<0?value:<>{value.slice(0,idx)}<span style={{color:cue.role==="system"?mint:gold}}>{marked}</span>{value.slice(idx+marked.length)}</>}
    </span>
  </div>;
}

function InkArrow({frame}) {
  const drawn=Math.min(1,(frame+1)/11);
  return <svg style={place(335,687,{width:239,height:131,transform:"rotate(-5deg)"})} viewBox="0 0 239 131" fill="none">
    {["#222623","#fef2bd"].map((color,i)=><path key={color}
      d="M222 12 C218 94 131 14 42 95 M45 70 L35 104 L72 98" stroke={color}
      strokeWidth={i?5:10} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={drawn+" 1"}/>)}
  </svg>;
}

function Scene({scene}) {
  const f=useCurrentFrame();
  const cuts=shots(scene);
  return <AbsoluteFill style={{background:"#162027",overflow:"hidden",color:"white"}}>
    {cuts.map((shot,i)=><Sequence key={i} from={shot.at} durationInFrames={(cuts[i+1]?.at ?? scene.frames)-shot.at}><Lens shot={shot}/></Sequence>)}
    <AbsoluteFill style={{background:"linear-gradient(180deg,#1317220a 0%,transparent 43%,#10121908 56%,#15151a36 70%,transparent 91%)"}}/>
    {scene.id==="hook"&&f<81&&<div style={place(69,278,{...outline,color:"#fff2b4",fontSize:39,fontWeight:770,letterSpacing:"-.045em",
      transform:"rotate(-3.4deg)"})}>치킨 vs 나</div>}
    {scene.id==="idea"&&f<34&&<InkArrow frame={f}/>}
    {scene.id==="quote"&&f>=182&&<div style={place(75,348,{...outline,color:mint,fontSize:38,fontWeight:760})}>앱 실기 · 모의 결제</div>}
    {scene.id==="traffic"&&f<89&&<div style={place(76,341,{...outline,color:gold,fontSize:43,fontWeight:770,transform:"rotate(-3deg)"})}>다음 날 저녁</div>}
    {scene.id==="traffic"&&((f>=50&&f<93)||f>=233)&&<div style={place(82,544,{...outline,color:"white",fontSize:43,fontWeight:740,letterSpacing:"-.035em"})}>
      매장 전송　<span style={{color:f>=233?gold:"white"}}>{f>=233?"16:27 → 16:42":"16:27"}</span></div>}
    <Subtitles scene={scene} frame={f}/>
    {scene.id==="finish"&&f>=103&&<div style={place(0,1241,{width:1030,display:"flex",justifyContent:"center",alignItems:"center",gap:6,
      filter:"drop-shadow(0 3px 8px #101915a0)",transform:"translateY("+Math.max(0,8-(f-103))+"px)"})}>
      <Brand light size={93}/><b style={{fontSize:76,marginLeft:5,letterSpacing:"-.064em",fontWeight:800}}>플레오더</b>
    </div>}
  </AbsoluteFill>;
}

export function ShortFilm({cut}) {
  return <AbsoluteFill style={{fontFamily:'"Pleorder Film","Malgun Gothic",sans-serif'}}>
    <Typeface/>{cut.scenes.map(scene=><Sequence key={scene.id} from={scene.from} durationInFrames={scene.frames}><Scene scene={scene}/></Sequence>)}
  </AbsoluteFill>;
}

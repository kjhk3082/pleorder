import React from "react";
import {AbsoluteFill, Easing, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame} from "remotion";

export const ink = "#092D45", mint = "#20B2A5", lightMint = "#86E4CD", night = "#08283B", linen = "#F6F2E9";
export const sans = '"Noto Sans KR","Malgun Gothic",sans-serif';
export const digits = '"Bahnschrift","Arial",sans-serif';
export const at = (left, top, extra={}) => ({position:"absolute",left,top,...extra});
export const ease = (f, a=0, b=19) => interpolate(f,[a,b],[0,1],{extrapolateLeft:"clamp",extrapolateRight:"clamp",easing:Easing.out(Easing.cubic)});
const symbol = "M20 91V43C20 23 35 8 54 8C74 8 89 23 89 43C89 52 85 60 78 67L65 57C69 53 71 48 71 43C71 33 64 26 54 26C44 26 37 33 37 43V62H51C56 62 61 60 64 58L74 72C68 77 61 80 51 80H37V91C37 96 33 100 29 100C24 100 20 96 20 91Z";

export function Mark({size=62,color=ink,dot=mint,hideDot=false}){
  return <svg width={size} height={size} viewBox="0 0 108 108"><path d={symbol} fill={color}/>{!hideDot && <circle cx="81" cy="80" r="8" fill={dot}/>}</svg>;
}
export function Header({dark=false, note}){
  const color=dark?"#F7FAF5":ink;
  return <div style={at(82,38,{right:88,height:84,borderBottom:"1.5px solid "+(dark?"#406070":"#C8D1CB"),display:"flex",alignItems:"flex-start",justifyContent:"space-between",color})}>
    <div style={{display:"flex",alignItems:"center",gap:6}}><Mark size={51} color={color}/><b style={{fontSize:35,fontWeight:850,letterSpacing:-2.5,lineHeight:"50px"}}>플레오더</b></div>
    <div style={{fontSize:25,lineHeight:"50px",fontWeight:550,letterSpacing:-.7,color:dark?"#CEDDDF":"#435E65"}}>{note}</div>
  </div>;
}
export function Label({children,dark=false,color}){
  return <div style={{display:"flex",alignItems:"center",gap:15,color:color||(dark?lightMint:"#126D66"),fontSize:29,fontWeight:670,letterSpacing:-1}}>
    <span style={{width:28,height:3,background:"currentColor"}}/>{children}</div>;
}
export function Headline({lines,begin=0,size=86,color=ink}){
  const f=useCurrentFrame();
  return <div style={{fontSize:size,fontWeight:840,letterSpacing:-size*.073,lineHeight:1.21,color}}>
    {lines.map((v,i)=>{const p=ease(f,begin+i*2,begin+16+i*2);return <div key={v} style={{overflow:"hidden",paddingBottom:4}}>
      <div style={{transform:`translateY(${(1-p)*88}%)`,opacity:Math.min(1,.3+p)}}>{v}</div></div>})}</div>;
}
export function Surface({dark=false,theme,children}){
  return <AbsoluteFill style={{background:theme||(dark?night:linen),color:dark?"#F7FBF7":ink,fontFamily:sans,overflow:"hidden"}}>{children}</AbsoluteFill>;
}
export function Captions({scene,dark=false}){
  const f=useCurrentFrame(), ms=f*1000/30;
  const cue=scene.cues.find(c=>ms>=c.startMs && ms<c.endMs);
  if(!cue)return null;
  return <div style={at(70,964,{right:70,display:"flex",justifyContent:"center",pointerEvents:"none"})}>
    <div style={{fontSize:36,lineHeight:1.42,whiteSpace:"pre-line",maxWidth:1760,textAlign:"center",letterSpacing:-1.25,fontWeight:570,color:dark?"#F5F9F7":ink,background:dark?"#102E3F":"#FFFFFFC9",borderRadius:14,padding:"7px 25px 10px"}}>{cue.text}</div></div>;
}
export function Playing({scene}){
  const frame=useCurrentFrame();
  return scene.shots.map((shot,i)=><Sequence key={shot.file+"-"+i} from={shot.at} durationInFrames={shot.frames} layout="none">
    <OffthreadVideo src={staticFile(shot.file)} muted style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"contain", transform:shot.hold?`scale(${1+.034*ease(frame,shot.at,shot.at+shot.frames)})`:undefined}}/>
  </Sequence>);
}
export function Panel({scene,rect=[695,175,1130,706],foot,dark=false,bg}){
  const f=useCurrentFrame(),p=ease(f,0,20);
  const [x,y,w,h]=rect;
  return <>
    <div style={at(x,y,{width:w,height:h,borderRadius:26,padding:0,overflow:"hidden",background:bg||"#DAE5E8",
      border:"3px solid "+(dark?"#76939D":"#FAFCFB"),boxSizing:"border-box",boxShadow:dark?"0 20px 45px #00192C60":"0 24px 45px #203E471D",transform:`translateY(${(1-p)*17}px) scale(${.992+.008*p})`})}><Playing scene={scene}/></div>
    {foot && <div style={at(x+6,y+h+14,{width:w-10,textAlign:"right",fontSize:22,fontWeight:520,letterSpacing:-.6,color:dark?"#BFD3D5":"#50696C"})}>{foot}</div>}
  </>;
}
export function RouteLine({phase=0,dark=false,labels=["출발","매장","목적지"]}){
  const f=useCurrentFrame(),fg=dark?lightMint:"#147E75",muted=dark?"#68868D":"#B9C7BE";
  const p=ease(f,5,58), end=phase===0?240:424;
  return <div style={{width:455,height:100,position:"relative"}}>
    <svg width="455" height="58" viewBox="0 0 455 58">
      <path d="M18 31 H132 Q149 31 159 22 Q173 10 190 10 H231 Q247 10 261 21 Q273 31 291 31 H424" fill="none" stroke={muted} strokeWidth="3"/>
      <path d="M18 31 H132 Q149 31 159 22 Q173 10 190 10 H231 Q247 10 261 21 Q273 31 291 31 H424" fill="none" stroke={fg} strokeWidth="5" strokeLinecap="round" pathLength="1" strokeDasharray={p*(end/424)+" 1"}/>
      {[[18,31],[211,10],[424,31]].map(([x,y],i)=><circle key={x} cx={x} cy={y} r={i===phase+1?9:5} fill={i<=phase+1?fg:muted}/>)}
    </svg>
    <div style={{display:"flex",justifyContent:"space-between",fontSize:23,letterSpacing:-.8,fontWeight:550,color:dark?"#BFD3D5":"#4A6468"}}>{labels.map(l=><span key={l}>{l}</span>)}</div>
  </div>;
}

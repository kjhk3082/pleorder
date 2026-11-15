import React from "react";
import {AbsoluteFill, Img, OffthreadVideo, Sequence, staticFile, useCurrentFrame} from "remotion";
import {Brand, Typeface} from "./StudioFilm";

const dark="#102027", teal="#006e62", mint="#9de9d5", ivory="#f6f2e9";
const at=(left,top,style={})=>({position:"absolute",left,top,...style});
const ease=(f,n=17)=>1-(1-Math.max(0,Math.min(1,f/n)))**3;

function Photo({name,style,frame}){
  return <Img src={staticFile(name)} style={{width:"100%",height:"100%",objectFit:"cover",transform:"scale("+(1.035+.045*ease(frame,90))+")",...style}}/>;
}
function Head({children,frame,color=dark,size=105}){
  return <div style={{color,fontSize:size,fontWeight:790,lineHeight:1.08,letterSpacing:"-.065em",whiteSpace:"pre-line",transform:"translateY("+18*(1-ease(frame))+"px)"}}>{children}</div>;
}
function Eyebrow({children,color=teal}){
  return <div style={{fontSize:31,fontWeight:680,letterSpacing:"-.035em",color,marginBottom:22}}>{children}</div>;
}
function ActualScreen({scene,top=755,source=scene.clip}){
  return <div style={at(54,top,{width:888,height:635,display:"grid",placeItems:"center",boxSizing:"border-box",padding:17,borderRadius:35,background:"#e3ebe6",border:"2px solid #c4d7cd",overflow:"hidden"})}>
    <OffthreadVideo muted src={staticFile(source)} style={{width:"100%",height:"100%",objectFit:"contain",borderRadius:20}}/>
  </div>;
}
function ShortCaptions({scene,f}){
  const cue=scene.cues.find(c=>c.startMs<=f/30*1000&&f/30*1000<c.endMs);
  if(!cue)return null;
  return <div style={at(74,1484,{width:818,display:"flex",justifyContent:"flex-start"})}>
    <div style={{background:"#112028ef",color:"white",borderRadius:21,padding:"15px 24px",fontSize:47,fontWeight:590,letterSpacing:"-.045em",lineHeight:1.32,wordBreak:"keep-all"}}>
      {cue.role==="system"&&<span style={{color:mint,fontSize:29,display:"block",marginBottom:4}}>차량 음성</span>}{cue.text}
    </div>
  </div>;
}
function Road({frame}){
  return <Photo name="drive-home.jpg" frame={frame} style={{position:"absolute",inset:0,objectPosition:"62% 50%"}}/>;
}
function Scene({scene}){
  const f=useCurrentFrame(),id=scene.id;
  const absolute=scene.from+f,stamp=scene.cues.find(c=>c.text.includes("칠십오")||c.text.includes("27분"));
  const number=stamp?Math.round(stamp.startMs*.03):0;
  const showTraffic=f>Math.round(scene.frames*.42);
  return <AbsoluteFill style={{background:ivory,color:dark,overflow:"hidden"}}>
    {id==="hook"&&<>
      <Road frame={f}/><AbsoluteFill style={{background:"linear-gradient(0deg,#05171bd9,transparent 73%)"}}/>
      <div style={at(0,0,{width:"100%",height:668,overflow:"hidden",borderBottom:"6px solid #f8efe1"})}>
        <Photo name={f<32?"delivery-proof.png":"chicken.png"} frame={f<32?f:f-32} style={{objectPosition:"50% 57%"}}/>
      </div>
      <div style={at(74,402,{background:"#102027e8",borderRadius:20,padding:"12px 26px",color:"white",fontWeight:740,fontSize:69,letterSpacing:"-.052em"})}>치킨은 벌써 문 앞.</div>
      <div style={at(71,844,{width:935})}><Head color="white" size={114} frame={f}>{"나는 아직\n강변북로."}</Head></div>
    </>}
    {id==="idea"&&<>
      <Road frame={f}/><AbsoluteFill style={{background:"linear-gradient(180deg,#0d1b23da 9%,#152c3133 49%,#05161bba)"}}/>
      <div style={at(72,239)}><Eyebrow color={mint}>퇴근길에 만든 앱</Eyebrow><Head frame={f} color="white" size={94}>{"오늘 저녁,\n차에서 주문해요."}</Head></div>
      {f<Math.round(scene.frames*.45)?<div style={at(74,850,{display:"flex",alignItems:"center",gap:26,padding:"25px 42px 25px 27px",background:"#fffffff0",borderRadius:36})}><Brand size={116}/><b style={{fontSize:81,letterSpacing:"-.07em"}}>플레오더</b></div>:
        <><ActualScreen scene={scene} top={680}/><div style={at(100,716,{fontSize:36,fontWeight:670,color:dark,background:"#fffffff1",borderRadius:17,padding:"9px 22px"})}>목적지 주변 매장</div></>}
    </>}
    {id==="order"&&<>
      <Photo name="chicken.png" frame={f} style={{position:"absolute",top:547,height:900,objectPosition:"50% 53%"}}/>
      <div style={at(73,234)}><Eyebrow>운전자 → Gleo</Eyebrow><Head size={106} frame={f}>{"치킨 한 마리,\n우리 집으로."}</Head></div>
    </>}
    {id==="quote"&&<>
      <div style={at(73,227)}><Eyebrow>운전자가 승인할 때</Eyebrow><Head size={138} frame={f}>26,000원</Head>
      <div style={{fontSize:48,marginTop:25,letterSpacing:"-.045em",fontWeight:560,color:teal}}>현대카드 M · 모의 결제</div></div>
      <ActualScreen scene={scene} top={665} source={f<Math.round(scene.frames*.62)?scene.estimate:scene.clip}/>
    </>}
    {id==="status"&&<>
      <AbsoluteFill style={{background:"#11282b"}}/>
      <div style={at(75,244)}><Eyebrow color={mint}>같은 주문 · PO-0003</Eyebrow><Head size={100} frame={f} color="white">{"내 치킨,\n어디쯤 왔죠?"}</Head></div>
      <div style={at(75,790,{width:850,padding:"54px 47px",boxSizing:"border-box",borderRadius:38,background:"#e3f0e7"})}>
        <div style={{fontSize:38,color:teal,fontWeight:650}}>교촌치킨 잠실1호점</div>
        <div style={{marginTop:25,fontSize:90,fontWeight:760,letterSpacing:"-.065em"}}>{f>=number?"도착까지 약 27분":f/30*1000>scene.cues.find(c=>c.role==="system").startMs?"매장에서 조리 중":"주문 현황 조회"}</div>
        <div style={{display:"flex",gap:10,marginTop:39}}>{[0,1,2,3].map(i=><span key={i} style={{flex:1,height:8,borderRadius:8,background:i<1||(i===1&&f/30*1000>=scene.cues.find(c=>c.role==="system").startMs)?teal:"#bccfc5"}}/>)}</div>
      </div>
    </>}
    {id==="traffic"&&<>
      <div style={at(73,229)}><Eyebrow>정체가 생기면</Eyebrow><Head size={114} frame={f}>{showTraffic?"집까지 75분":"집까지 60분"}</Head>
      <div style={{fontSize:51,marginTop:22,color:teal,fontWeight:630,letterSpacing:"-.04em"}}>{showTraffic?"예약 전송도 15분 늦게":"도착에 맞춰 둔 예약"}</div></div>
      <ActualScreen scene={scene} top={660}/>
    </>}
    {id==="pickup"&&<>
      <div style={at(73,241)}><Eyebrow>가는 길에 픽업</Eyebrow><Head size={100} frame={f}>{"매장을\n경유할까요?"}</Head></div>
      <ActualScreen scene={scene} top={695}/>
      <svg style={at(77,1340)} width="775" height="67" viewBox="0 0 775 67" fill="none">
        <path d="M8 41h217c45 0 49-28 92-28h67c43 0 47 28 91 28h285" stroke="#bfd7ca" strokeWidth="8" strokeLinecap="round"/>
        <path d="M8 41h217c45 0 49-28 92-28h67c43 0 47 28 91 28h285" stroke={teal} strokeWidth="8" strokeLinecap="round" pathLength="1" strokeDasharray={ease(f,75)+" 1"}/>
        <circle cx="352" cy="13" r="10" fill={teal}/>
      </svg>
    </>}
    {id==="finish"&&<>
      <Photo name={f<Math.round(scene.frames*.60)?"chicken.png":"delivery-proof.png"} frame={f} style={{position:"absolute",top:640,height:920,objectFit:"cover"}}/>
      <div style={at(74,248)}><Eyebrow>집으로 배달 · 가는 길에 픽업</Eyebrow><Head size={102} frame={f}>{"저녁이랑,\n같이 도착."}</Head></div>
      <div style={at(78,1235,{background:"#fffdf3ed",borderRadius:27,display:"flex",alignItems:"center",gap:14,padding:"15px 28px 15px 17px"})}><Brand size={79}/><b style={{fontSize:60,letterSpacing:"-.065em"}}>플레오더</b></div>
    </>}
    <ShortCaptions scene={scene} f={f}/>
    <div style={at(73,1763,{height:4,width:815,background:"#a2b3ab75",borderRadius:4})}>
      <div style={{background:id==="idea"||id==="hook"||id==="status"?mint:teal,height:"100%",width:(100*absolute/scene.total)+"%"}}/>
    </div>
  </AbsoluteFill>;
}

export function ShortFilm({cut}){
  return <AbsoluteFill style={{fontFamily:'"Pleorder Film","Malgun Gothic",sans-serif'}}>
    <Typeface/>{cut.scenes.map(s=><Sequence key={s.id} from={s.from} durationInFrames={s.frames}><Scene scene={{...s,total:cut.frames}}/></Sequence>)}
  </AbsoluteFill>;
}

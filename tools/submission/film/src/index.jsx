import React from "react";
import {Composition, registerRoot, staticFile, Still} from "remotion";
import {Cover, StudioFilm} from "./StudioFilm";
import {ShortFilm} from "./ShortFilm";

async function metadata({props}){
  if(props.edition==="Short"){
    const response=await fetch(staticFile("shortform.json"));
    if(!response.ok)throw new Error("Generate the short film with shortform.py prepare first.");
    const cut=await response.json();
    return {durationInFrames:cut.frames,props:{...props,cut}};
  }
  const response=await fetch(staticFile("editions.json"));
  if(!response.ok)throw new Error("Generate the editorial timelines with edition.py first.");
  const cut=(await response.json())[props.edition];
  return {durationInFrames:cut.frames,props:{...props,cut}};
}
function Root(){
  return <>
    <Still id="Cover" width={1600} height={560} component={Cover}/>
    <Composition id="Short" fps={30} width={1080} height={1920} durationInFrames={1} calculateMetadata={metadata} component={ShortFilm} defaultProps={{edition:"Short",cut:null}}/>
    {["Film","Gleo","Full"].map(id=><Composition key={id} id={id} fps={30} width={1920} height={1080}
      durationInFrames={1} calculateMetadata={metadata} component={StudioFilm} defaultProps={{edition:id,cut:null}}/>)}
  </>;
}
registerRoot(Root);

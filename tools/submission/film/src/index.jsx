import React from "react";
import {Composition, registerRoot, staticFile, Still} from "remotion";
import {Cover, StudioFilm} from "./StudioFilm";

async function metadata({props}){
  const response=await fetch(staticFile("editions.json"));
  if(!response.ok)throw new Error("Generate the editorial timelines with edition.py first.");
  const cut=(await response.json())[props.edition];
  return {durationInFrames:cut.frames,props:{...props,cut}};
}
function Root(){
  return <>
    <Still id="Cover" width={1600} height={560} component={Cover}/>
    {["Film","Gleo","Full"].map(id=><Composition key={id} id={id} fps={30} width={1920} height={1080}
      durationInFrames={1} calculateMetadata={metadata} component={StudioFilm} defaultProps={{edition:id,cut:null}}/>)}
  </>;
}
registerRoot(Root);

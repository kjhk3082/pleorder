import React from "react";
import {AbsoluteFill, Composition, Html5Audio, registerRoot, Sequence, staticFile} from "remotion";
import timeline from "../public/cut.json";
import {Intro, Outro} from "./BrandScenes";
import {Decline, Door, Driving, Explore, Pickup, Traffic} from "./ProductScenes";
import {VoiceScene} from "./VoiceScene";

const sections=Object.fromEntries(timeline.scenes.map(scene=>[scene.id,scene]));
function Part({scene,children:Scene}){
  return <Sequence name={scene.title} from={scene.from} durationInFrames={scene.frames}><Scene scene={scene}/></Sequence>;
}
function Film(){
  return <AbsoluteFill style={{background:"#08283B"}}>
    <Part scene={sections.intro}>{Intro}</Part>
    <Part scene={sections.explore}>{Explore}</Part>
    <Part scene={sections.voice}>{VoiceScene}</Part>
    <Part scene={sections.decline}>{Decline}</Part>
    <Part scene={sections.traffic}>{Traffic}</Part>
    <Part scene={sections.door}>{Door}</Part>
    <Part scene={sections.pickup}>{Pickup}</Part>
    <Part scene={sections.drive}>{Driving}</Part>
    <Part scene={sections.outro}>{Outro}</Part>
    <Html5Audio src={staticFile("master.m4a")}/>
  </AbsoluteFill>;
}
const Root=()=> <Composition id="Pleorder" component={Film} durationInFrames={timeline.frames} fps={timeline.fps} width={1920} height={1080}/>;
registerRoot(Root);

import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {execFileSync} from "node:child_process";
import {bundle} from "@remotion/bundler";
import {openBrowser, renderMedia, renderStill, selectComposition} from "@remotion/renderer";

const film=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(film,"../../..");
const work=path.join(repo,".cache/submission/film/edition-render");
const out=path.join(repo,"산출물/02_시연영상");
const names={Film:"플레오더_대표시연",Gleo:"플레오더_Gleo_실기시연",Full:"플레오더_전체기능시연"};
fs.mkdirSync(work,{recursive:true});
process.chdir(film);
const options={browserExecutable:process.env.CHROME_FOR_RENDER,logLevel:"warn"};
const bundleDir=fs.mkdtempSync(path.join(work,"bundle-"));
let browser;
try{
  const serveUrl=await bundle({entryPoint:path.join(film,"src/index.jsx"),rootDir:film,publicDir:path.join(film,"public"),enableCaching:true,outDir:bundleDir});
  browser=await openBrowser("chrome",options);
  const shared={...options,serveUrl,puppeteerInstance:browser,timeoutInMilliseconds:90000};
  if(process.argv.includes("--cover")){
    const comp=await selectComposition({...shared,id:"Cover"});
    await renderStill({...shared,composition:comp,imageFormat:"jpeg",jpegQuality:96,output:path.join(repo,"docs/design/pleorder-cover.jpg")});
  }else if(process.argv.includes("Short")){
    const cut=JSON.parse(fs.readFileSync(path.join(film,"public/shortform.json"),"utf8"));
    const comp=await selectComposition({...shared,id:"Short"});
    const shortWork=path.join(repo,".cache/submission/film/shortform");
    for(const s of cut.scenes){
      await renderMedia({...shared,composition:comp,codec:"h264",crf:16,x264Preset:"fast",jpegQuality:94,colorSpace:"bt709",muted:true,
        frameRange:[s.from,s.from+s.frames-1],concurrency:Number(process.env.RENDER_CONCURRENCY||4),offthreadVideoThreads:2,
        outputLocation:path.join(shortWork,s.id+"-picture.mp4")});
      console.log("SHORT_PICTURE",s.id,s.frames);
    }
  }else{
    const cuts=JSON.parse(fs.readFileSync(path.join(film,"public/editions.json"),"utf8"));
    const chosen=process.argv.filter(x=>Object.hasOwn(names,x));
    const ids=chosen.length?chosen:Object.keys(names);
    for(const id of ids){
      const cut=cuts[id],comp=await selectComposition({...shared,id});
      if(process.argv.includes("--proof")){
        for(const [k,s] of cut.scenes.entries()){
          const f=s.from+Math.min(s.frames-1,Math.round(s.frames*.56));
          await renderStill({...shared,composition:comp,frame:f,imageFormat:"jpeg",jpegQuality:90,scale:.55,output:path.join(work,id+"-"+String(k+1).padStart(2,"0")+".jpg")});
        }
      }else{
        let last=-1;
        const picture=path.join(work,id+"-picture.mp4");
        await renderMedia({...shared,composition:comp,codec:"h264",crf:19,x264Preset:"fast",jpegQuality:94,colorSpace:"bt709",muted:true,
          concurrency:Number(process.env.RENDER_CONCURRENCY||4),offthreadVideoThreads:2,outputLocation:picture,
          onProgress:({progress})=>{const p=Math.floor(progress*10);if(p!==last){last=p;console.log(id,p*10+"%");}}});
        const ffdir=path.join(repo,".cache/submission/media-deps/imageio_ffmpeg/binaries");
        const cached=fs.existsSync(ffdir)?fs.readdirSync(ffdir).find(x=>x.endsWith(".exe")):null;
        const ff=process.env.FFMPEG||(cached?path.join(ffdir,cached):"ffmpeg");
        const assembled=path.join(work,id+"-final.mp4");
        execFileSync(ff,["-nostdin","-v","error","-y","-i",picture,"-i",path.join(film,"public",cut.master),
          "-map","0:v:0","-map","1:a:0","-c","copy","-movflags","+faststart","-metadata","title="+names[id],assembled]);
        fs.copyFileSync(assembled,path.join(out,names[id]+".mp4"));
      }
    }
  }
}finally{
  try{await browser?.close({silent:true});}
  finally{fs.rmSync(bundleDir,{recursive:true,force:true,maxRetries:3,retryDelay:150});}
}

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {bundle} from '@remotion/bundler';
import {openBrowser, renderMedia, renderStill, selectComposition} from '@remotion/renderer';

const film=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(film,'../../..');
const work=path.join(repo,'.cache/submission/film/render');
const output=path.join(repo,'산출물/02_시연영상','플레오더_대표시연.mp4');
const cut=JSON.parse(fs.readFileSync(path.join(film,'public/cut.json'),'utf8'));
const proof=process.argv.includes('--proof');
fs.mkdirSync(work,{recursive:true});
process.chdir(film);
const browser=process.env.CHROME_FOR_RENDER;
const options={browserExecutable:browser, logLevel:'warn'};
const serveUrl=await bundle({entryPoint:path.join(film,'src/index.jsx'),rootDir:film,
  publicDir:path.join(film,'public'),outDir:path.join(work,'bundle'),enableCaching:false});
const chrome=await openBrowser('chrome',options);
try{
  const shared={...options,serveUrl,puppeteerInstance:chrome,timeoutInMilliseconds:60000};
  const composition=await selectComposition({...shared,id:'Pleorder'});
  if(proof){
    for(const [id,second] of [['intro',2],['intro',7.7],['explore',8.3],['voice',1.4],['voice',15.7],
      ['decline',6.4],['traffic',10.5],['door',6.9],['pickup',7.7],['drive',5.9],['outro',4.9]]){
      const scene=cut.scenes.find(s=>s.id===id);
      await renderStill({...shared,composition,frame:Math.min(scene.from+Math.round(second*cut.fps),scene.from+scene.frames-1),
        imageFormat:'png',scale:0.67,output:path.join(work,id+'-'+second+'.png')});
    }
    console.log('Rendered chapter review frames to',work);
  }else{
    let progress=-1;
    const picture=path.join(work,'picture.mp4');
    await renderMedia({...shared,composition,codec:'h264',crf:18,x264Preset:'fast',jpegQuality:93,
      colorSpace:'bt709',muted:true,concurrency:Number(process.env.RENDER_CONCURRENCY||4),offthreadVideoThreads:2,
      outputLocation:picture,onProgress:({progress:p})=>{
        const step=Math.floor(p*20);
        if(step!==progress){progress=step;console.log('Picture '+5*step+'%');}
      }});
    const ffdir=path.join(repo,'.cache/submission/media-deps/imageio_ffmpeg/binaries');
    const cached=fs.existsSync(ffdir) ? fs.readdirSync(ffdir).find(x=>x.endsWith('.exe')) : null;
    const ff=process.env.FFMPEG || (cached ? path.join(ffdir,cached) : 'ffmpeg');
    const temp=path.join(work,'release.mp4');
    execFileSync(ff,['-v','error','-y','-i',picture,'-i',path.join(film,'public/master.m4a'),'-map','0:v:0','-map','1:a:0',
      '-c','copy','-movflags','+faststart','-metadata','title=플레오더 | 도착에 맞춘 한 끼',temp]);
    fs.copyFileSync(temp,output);
    console.log('Exported',output);
  }
}finally{
  await chrome.close({silent:true});
}

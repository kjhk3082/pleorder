const http = require("node:http"), https = require('node:https'),
  fs = require("node:fs"),
  path = require("node:path");
const root = path.resolve(__dirname, "../app/src/main/assets/web"),
  port = Number(process.env.PLEORDER_PORT || 4173);
const {config,createDirections}=require('./naver-directions.cjs');
const directions=createDirections();
const handler=async (req, res) => {
    let relative;
    try {
      relative = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      );
    } catch {
      res.writeHead(400).end();
      return;
    }
    if (relative === '/map-config.json') {
      let naverClientId = '';
      try {const c=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../.local/naver-maps.json'),'utf8'));if(/^[a-zA-Z0-9_-]{5,80}$/.test(c.naverClientId))naverClientId=c.naverClientId;} catch {}
      res.setHeader('Content-Type','application/json; charset=utf-8');
      res.setHeader('Cache-Control','no-store');
      res.end(JSON.stringify({naverClientId,routeEndpoint:config().naverClientSecret?'/api/directions':''}));return;
    }
    if(relative==='/api/directions') {
      const allowed=new Set(['https://appassets.androidplatform.net','https://localhost:4174','https://127.0.0.1:4174','http://127.0.0.1:4173','http://localhost:4173']);
      if(!allowed.has(req.headers.origin)){res.writeHead(403).end();return;}
      res.setHeader('Access-Control-Allow-Origin',req.headers.origin);res.setHeader('Vary','Origin');
      res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type');
      res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json');
      if(req.method==='OPTIONS'){res.writeHead(204).end();return;}
      if(req.method!=='POST'||!req.headers['content-type']?.startsWith('application/json')){res.writeHead(405).end();return;}
      let body='';try {
        for await(const chunk of req){body+=chunk;if(body.length>2048){res.writeHead(413).end();return;}}
        const {points}=JSON.parse(body);const route=await directions(points);res.end(JSON.stringify({route}));
      } catch(error){res.writeHead(422).end(JSON.stringify({message:error instanceof SyntaxError?'경로 요청 형식을 확인해 주세요.':error.message}));}
      return;
    }
    const file = path.resolve(
      root,
      "." + (relative === "/" ? "/index.html" : relative),
    );
    if (!file.startsWith(root + path.sep)) {
      res.writeHead(403).end();
      return;
    }
    fs.readFile(file, (err, data) => {
      if (err) {
        res.writeHead(404).end();
        return;
      }
      res.setHeader(
        "Content-Type",
        {
          ".html": "text/html; charset=utf-8",
          ".js": "application/javascript; charset=utf-8",
          ".css": "text/css; charset=utf-8",
          ".json": "application/json; charset=utf-8",
          ".svg": "image/svg+xml",
        }[path.extname(file)] || "application/octet-stream",
      );
      res.end(data);
    });
  };
if(process.env.PLEORDER_HTTPS==='1') {
  const base=path.resolve(__dirname,'../.local');
  https.createServer({key:fs.readFileSync(path.join(base,'preview-key.pem')),cert:fs.readFileSync(path.join(base,'preview-cert.pem'))},handler)
    .listen(port,'127.0.0.1',()=>console.log(`Pleorder secure preview: https://localhost:${port}`));
} else http.createServer(handler).listen(port,'127.0.0.1',()=>console.log(`Pleorder preview: http://127.0.0.1:${port}`));

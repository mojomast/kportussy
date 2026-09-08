import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
import { createApp } from './app.mjs';

// One loopback process serves the build and API; no global service installation.
export function createHttpServer(store, dist=resolve('dist')) {
  const app=createApp(store);
  return createServer(async (req,res) => {
    try {
      const url=new URL(req.url,`http://${req.headers.host}`);
      if(!['127.0.0.1','localhost','[::1]'].includes(url.hostname)) {res.writeHead(403);res.end('Loopback Host required');return;}
      if(url.pathname.startsWith('/api/')) {
        if(req.headers.origin && req.headers.origin!==url.origin) { res.writeHead(403); res.end('Cross-origin requests forbidden'); return; }
        let body;
        if(!['GET','HEAD'].includes(req.method)) {
          if(!String(req.headers['content-type']).startsWith('application/json')) { res.writeHead(415); res.end('JSON required'); return; }
          const chunks=[]; let size=0;
          for await(const chunk of req) { size+=chunk.length; if(size>2*1024*1024) { res.writeHead(413); res.end('Body too large'); return; } chunks.push(chunk); }
          body=Buffer.concat(chunks);
        }
        const response=await app(new Request(url,{method:req.method,headers:req.headers,body}));
        res.writeHead(response.status,Object.fromEntries(response.headers)); res.end(Buffer.from(await response.arrayBuffer())); return;
      }
      if(!['GET','HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return; }
      const path=resolve(dist,`.${decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname)}`);
      if(!path.startsWith(resolve(dist)+sep)) { res.writeHead(403); res.end(); return; }
      let bytes;
      try { bytes=readFileSync(path); } catch { res.writeHead(404); res.end('Build asset not found. Run npm run build.'); return; }
      res.writeHead(200,{'content-type':{'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'}[extname(path)] || 'application/octet-stream','x-content-type-options':'nosniff','cache-control':'no-cache'});
      res.end(req.method==='HEAD'?undefined:bytes);
    } catch { res.writeHead(400); res.end('Invalid request'); }
  });
}

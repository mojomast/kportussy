import { createServer } from 'node:http';
import { createApp } from './app.mjs';

const port = Number(process.env.KPORTUSSY_API_PORT || 8787);
const host = process.env.KPORTUSSY_API_HOST || '127.0.0.1';
const app = createApp();
const server = createServer(async (req,res)=>{
  const response = await app(new Request(`http://${req.headers.host}${req.url}`, { method:req.method, headers:req.headers, body: req.method === 'GET' || req.method === 'HEAD' ? undefined : req }));
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
});
server.listen(port, host, ()=>console.log(`Kportussy API live on http://${host}:${port}`));

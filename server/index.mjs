import { createHttpServer } from './http.mjs';
const port=Number(process.env.KPORTUSSY_API_PORT || 8787);
const host=process.env.KPORTUSSY_API_HOST || '127.0.0.1';
if(!['127.0.0.1','::1','localhost'].includes(host)) throw new Error('Local MVP must bind to loopback; authentication is not implemented.');
const server=createHttpServer();
server.listen(port,host,()=>console.log(`Kportussy local workbench: http://${host}:${server.address().port}`));

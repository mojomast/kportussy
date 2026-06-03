import { spawn } from 'node:child_process';
const procs=[['api',['run','dev:api']],['web',['run','dev','--','--host',process.env.KPORTUSSY_WEB_HOST||'127.0.0.1','--port',process.env.KPORTUSSY_WEB_PORT||'5179']]];
const children=procs.map(([name,args])=>{ const p=spawn('npm',args,{stdio:['ignore','pipe','pipe'],shell:false}); p.stdout.on('data',d=>process.stdout.write(`[${name}] ${d}`)); p.stderr.on('data',d=>process.stderr.write(`[${name}] ${d}`)); return p; });
function stop(){ for(const p of children) p.kill('SIGTERM'); }
process.on('SIGINT',()=>{stop();process.exit(0)}); process.on('SIGTERM',()=>{stop();process.exit(0)});

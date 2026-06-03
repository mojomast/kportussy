const base=process.env.KPORTUSSY_API_BASE || 'http://127.0.0.1:8787/api';
for (const path of ['/health','/dashboard','/claims','/events']) {
  const res=await fetch(`${base}${path}`);
  if(!res.ok) throw new Error(`${path} failed ${res.status}`);
}
console.log(`api smoke ok: ${base}`);

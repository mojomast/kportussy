import { createStore } from './store.mjs';

export function createApp(store = createStore()){
  async function body(req){ try { return await req.json(); } catch { return {}; } }
  function json(obj,status=200){ return new Response(JSON.stringify(obj),{status,headers:{'content-type':'application/json'}}); }
  function err(e,status=400){ return json({error:e.message || String(e)}, status); }
  return async function handler(req){
    const url=new URL(req.url); const path=url.pathname.replace(/^\/api/,'') || '/';
    try{
      if(req.method==='GET' && path==='/health') return json(store.health());
      if(req.method==='GET' && path==='/dashboard') return json(store.dashboard());
      if(req.method==='GET' && path==='/claims') return json({claims:store.listClaims()});
      if(req.method==='GET' && path==='/events') return json({events:store.events(Number(url.searchParams.get('limit')||100))});
      if(req.method==='GET' && path==='/roadmap') return json({roadmap:store.state.roadmap});
      const claimMatch=path.match(/^\/claims\/([^/]+)$/);
      if(req.method==='GET' && claimMatch) { const c=store.getClaim(claimMatch[1]); return c ? json(c) : err(new Error('claim not found'),404); }
      if(req.method==='POST' && path==='/claims') return json(store.createClaim(await body(req)),201);
      const statusMatch=path.match(/^\/claims\/([^/]+)\/status$/);
      if(req.method==='POST' && statusMatch){ const b=await body(req); return json(store.updateStatus(statusMatch[1], b.status, b.actorId)); }
      const evidenceMatch=path.match(/^\/claims\/([^/]+)\/evidence-links$/);
      if(req.method==='POST' && evidenceMatch) return json(store.addEvidence(evidenceMatch[1], await body(req)),201);
      const verMatch=path.match(/^\/claims\/([^/]+)\/verifications$/);
      if(req.method==='POST' && verMatch) return json(store.addVerification(verMatch[1], await body(req)),201);
      if(req.method==='POST' && path==='/trust-signals/recompute'){ const b=await body(req); return json(store.recomputeTrust(b.claimId || b.claim_id, b.actorId)); }
      return err(new Error(`not found: ${req.method} ${path}`),404);
    }catch(e){ return err(e, String(e.message).includes('not found') ? 404 : 400); }
  };
}

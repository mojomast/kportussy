// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createStore } from '../server/store.mjs';
import { createApp } from '../server/app.mjs';
import App from './App';
const dirs=[];
afterEach(()=>{cleanup();vi.unstubAllGlobals();for(const dir of dirs.splice(0))rmSync(dir,{recursive:true,force:true});});
const input=(label,value)=>fireEvent.change(screen.getByLabelText(label),{target:{value}});
it('human workflow creates no stubs, binds evidence, verifies, disputes, revokes and inspects audit',async()=>{
  const base=resolve('artifacts/test');mkdirSync(base,{recursive:true});const dir=mkdtempSync(join(base,'ui-'));dirs.push(dir);const store=createStore(join(dir,'db.json'));const app=createApp(store);
  vi.stubGlobal('fetch',vi.fn((path,init)=>app(new Request(`http://local${path}`,init))));
  render(<App/>);await screen.findByText(/Connected to local store/);
  fireEvent.click(screen.getByRole('button',{name:'Create'}));
  input('Claim ID (optional; pin before producing receipts)','ui-claim');input('Subject','Local tool');input('Domain','demo');input('Scoped statement','Narrow test claim');input('Intended trust application','No external authority');input('Risk','low');
  fireEvent.click(screen.getByRole('button',{name:'Create claim'}));await screen.findByText('No evidence linked. No starter stubs are created.');
  expect(store.getClaim('ui-claim').evidence).toHaveLength(0);
  fireEvent.click(screen.getByRole('button',{name:'Set submitted'}));await screen.findByRole('button',{name:'Set under_review'});
  fireEvent.click(screen.getByRole('button',{name:'Set under_review'}));await screen.findByRole('button',{name:'Set verified'});expect(screen.getByRole('button',{name:'Set verified'})).toBeDisabled();
  input('Evidence summary','Actual test record');input('Source reference','private:test-report');fireEvent.click(screen.getByRole('button',{name:'Link evidence'}));await screen.findByText('Actual test record',{selector:'p'});
  input('Reviewer label (not authenticated)','Local tester');input('Review rationale','Reviewed actual evidence');input('Decision','accepted');
  fireEvent.click(screen.getByRole('checkbox'));fireEvent.click(screen.getByRole('button',{name:'Record review'}));
  await waitFor(()=>expect(screen.getByRole('button',{name:'Set verified'})).toBeEnabled());fireEvent.click(screen.getByRole('button',{name:'Set verified'}));await screen.findByRole('button',{name:'Set revoked'});
  expect(store.getClaim('ui-claim').status).toBe('verified');expect(screen.queryByText('private:test-report')).not.toBeInTheDocument();
  input('Evidence summary','Synthetic contradiction');input('Source reference','local:negative-control');input('Relation','contradicts');fireEvent.click(screen.getByRole('button',{name:'Link evidence'}));
  await waitFor(()=>expect(store.getClaim('ui-claim').status).toBe('disputed'));await waitFor(()=>expect(screen.getByRole('button',{name:'Set verified'})).toBeDisabled());
  fireEvent.click(screen.getByRole('button',{name:'Set revoked'}));await screen.findByText('Terminal status: history retained, no outgoing transition.');
  expect(store.getClaim('ui-claim').trust.score).toBe(0);fireEvent.click(screen.getByRole('button',{name:'Audit'}));await screen.findByText('Audit visibility');expect(screen.getAllByText(/claim.status_changed/).length).toBeGreaterThan(0);
});
it('offline mode has no fabricated fallback and disables mutation',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new Error('offline-test')));render(<App/>);await screen.findByText(/OFFLINE \/ STALE/);fireEvent.click(screen.getByRole('button',{name:'Create'}));expect(screen.getByRole('button',{name:'Create claim'})).toBeDisabled();expect(screen.queryByText(/Hermes Agent/)).not.toBeInTheDocument();
});

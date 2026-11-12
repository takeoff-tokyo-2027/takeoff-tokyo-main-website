import { useEffect, useState } from 'react';
import { TakeoffBadge, TakeoffButton, TakeoffCard, TakeoffInput, useTakeoffToast } from '@takeoff-tokyo/ui';
import { AccessibleModal } from './AccessibleModal';
import { api, money } from './client';
import { NumberInput } from '../components/NumberInput';
export interface AdminTicketType {
 id:string;code:string;label:string;public_purchase:boolean;deleted_at:string|null;ever_purchased:boolean;purchase_count:number;
 prices:{id:string;amount:number;currency:string;active:boolean;created_at:string}[];
}
interface Catalog {salesEnabled:boolean;ticketTypes:AdminTicketType[]}
type Editor={kind:'create';key:string}|{kind:'edit'|'price'|'delete';ticket:AdminTicketType;key:string};
export function TicketCatalogManager(){
 const {showToast}=useTakeoffToast();
 const [catalog,setCatalog]=useState<Catalog|null>(null);const [error,setError]=useState('');const [busy,setBusy]=useState(false);
 const [editor,setEditor]=useState<Editor|null>(null);const [name,setName]=useState('');const [code,setCode]=useState('');const [amount,setAmount]=useState('');const [available,setAvailable]=useState(false);const [showDeleted,setShowDeleted]=useState(false);
 async function load(){setCatalog(await api<Catalog>('/admin/ticket-types'));}
 useEffect(()=>{void load().catch(e=>setError(e.message));},[]);
 function open(kind:Editor['kind'],ticket?:AdminTicketType){
  setError('');setName(ticket?.label||'');setCode('');setAmount(String(ticket?.prices.find(p=>p.active)?.amount||''));setAvailable(ticket?.public_purchase||false);
  setEditor(kind==='create'?{kind,key:crypto.randomUUID()}:{kind,ticket:ticket!,key:crypto.randomUUID()});
 }
 async function run(action:()=>Promise<unknown>,message:string){
  setBusy(true);setError('');try{await action();setEditor(null);showToast({message,type:'success'});await load();}catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 async function submit(){
  if(!editor)return;
  if(editor.kind==='create')await run(()=>api('/admin/ticket-types','POST',{code,label:name,requestKey:editor.key}),'Ticket type created');
  else if(editor.kind==='edit')await run(()=>api(`/admin/ticket-types/${editor.ticket.id}`,'PATCH',{label:name,publicPurchase:available}),'Ticket type updated');
  else if(editor.kind==='price')await run(()=>api(`/admin/ticket-types/${editor.ticket.id}/prices`,'POST',{amount:Number(amount),requestKey:editor.key}),'Price updated');
  else await run(()=>api(`/admin/ticket-types/${editor.ticket.id}`,'DELETE'),'Unused ticket type deleted');
 }
 return <section className="ticket-form">
  <div className="page-heading"><h1>Tickets &amp; prices</h1><TakeoffButton variant="cyan" disabled={busy} onClick={()=>open('create')}>Create ticket type</TakeoffButton></div>
  {error&&<div className="ticket-error" role="alert">{error}{!editor&&<TakeoffButton variant="ghost" disabled={busy} onClick={()=>void load().then(()=>setError('')).catch(e=>setError(e.message))}>Reload</TakeoffButton>}</div>}
  {!catalog?<p>Loading ticket types…</p>:<>
   <TakeoffCard className="sales-control"><div className="page-heading"><div><h3>Public ticket sales <TakeoffBadge variant={catalog.salesEnabled?'cyan':'neutral'}>{catalog.salesEnabled?'Open':'Closed'}</TakeoffBadge></h3></div><TakeoffButton variant="secondary" disabled={busy} onClick={()=>void run(()=>api('/admin/ticket-sales','PATCH',{enabled:!catalog.salesEnabled}),catalog.salesEnabled?'Sales closed':'Sales opened')}>{catalog.salesEnabled?'Close sales':'Open sales'}</TakeoffButton></div></TakeoffCard>
   <label className="ticket-checkbox"><input type="checkbox" checked={showDeleted} onChange={e=>setShowDeleted(e.target.checked)}/>Show deleted ticket types</label>
   <div className="ticket-catalog">{catalog.ticketTypes.filter(t=>showDeleted||!t.deleted_at).map(t=>{
    const current=t.prices.find(p=>p.active);const purchased=t.ever_purchased||t.purchase_count>0;const crew=t.code==='crew';
    return <TakeoffCard key={t.id} className="catalog-card"><div className="page-heading"><h3>{t.label}</h3><TakeoffBadge variant={t.deleted_at?'neutral':t.public_purchase?'cyan':'neutral'}>{t.deleted_at?'Deleted':crew?'Private':t.public_purchase?'Available':'Paused'}</TakeoffBadge></div>
     <span className="catalog-code">{t.code}</span><div className="catalog-price"><strong>{crew?'Free':current?money(current.amount,current.currency):'No price set'}</strong><span>{t.purchase_count} paid {t.purchase_count===1?'order':'orders'}</span></div>
     <div className="ticket-actions">{t.deleted_at?<TakeoffButton variant="secondary" disabled={busy} onClick={()=>void run(()=>api(`/admin/ticket-types/${t.id}/restore`,'POST',{}),'Ticket type restored')}>Restore type</TakeoffButton>:<>
      <TakeoffButton variant="secondary" size="sm" disabled={busy} aria-label={`Edit ${t.label}`} onClick={()=>open('edit',t)}>Edit</TakeoffButton>
      {!crew&&<TakeoffButton variant="cyan" size="sm" disabled={busy} onClick={()=>open('price',t)}>{current?'Change price':'Set price'}</TakeoffButton>}
      <TakeoffButton variant="danger" size="sm" disabled={busy||purchased} aria-label={`Delete ${t.label}`} onClick={()=>open('delete',t)}>Delete</TakeoffButton>
     </>}</div>
     {purchased&&<small>Purchased · Deletion locked</small>}
     {!!t.prices.length&&<details className="catalog-history"><summary>Price history ({t.prices.length})</summary><ul>{t.prices.map(p=><li key={p.id}>{money(p.amount,p.currency)} · {p.active?'Current':'Historical'} · {new Date(p.created_at).toLocaleString()}</li>)}</ul></details>}
    </TakeoffCard>;
   })}</div>
  </>}
  <AccessibleModal isOpen={!!editor} onClose={()=>{if(!busy)setEditor(null);}} title={editor?.kind==='create'?'Create public ticket type':editor?.kind==='edit'?'Edit ticket type':editor?.kind==='price'?'Set ticket price':'Delete unused ticket type?'}>
   {editor&&<form className="ticket-form" onSubmit={e=>{e.preventDefault();void submit();}}>
    {editor.kind==='create'&&<><label>Ticket code<TakeoffInput required value={code} placeholder="general_admission" title="Start with a letter; use lowercase letters, numbers or underscores." onChange={e=>setCode(e.target.value.toLowerCase())} pattern="[a-z][a-z0-9_]{0,39}" maxLength={40} disabled={busy}/></label></>}
    {(editor.kind==='create'||editor.kind==='edit')&&<label>Ticket name<TakeoffInput required maxLength={120} value={name} disabled={busy} onChange={e=>setName(e.target.value)}/></label>}
    {editor.kind==='edit'&&editor.ticket.code!=='crew'&&<label className="ticket-checkbox"><input type="checkbox" checked={available} disabled={busy||!editor.ticket.prices.some(p=>p.active)} onChange={e=>setAvailable(e.target.checked)}/>Available for public purchase{!editor.ticket.prices.some(p=>p.active)&&' (set a price first)'}</label>}
    {editor.kind==='price'&&<NumberInput label="Price (JPY)" min={1} max={99999999} step={1} required value={amount} disabled={busy} onValueChange={setAmount}/>}
    {editor.kind==='delete'&&<p>Delete {editor.ticket.label}?</p>}
    {error&&<p role="alert" className="ticket-error">{error}</p>}
    <div className="ticket-actions form-actions"><TakeoffButton type="submit" variant={editor.kind==='delete'?'danger':'cyan'} disabled={busy}>{busy?'Saving…':editor.kind==='delete'?'Confirm deletion':editor.kind==='create'?'Create type':'Save changes'}</TakeoffButton><TakeoffButton type="button" variant="ghost" disabled={busy} onClick={()=>setEditor(null)}>Cancel</TakeoffButton></div>
   </form>}
  </AccessibleModal>
 </section>;
}

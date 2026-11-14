import { useCallback, useEffect, useRef, useState } from 'react';
import { TakeoffButton, TakeoffInput, TakeoffCard, TakeoffBadge } from '@takeoff-tokyo/ui';
import type { Session } from '@supabase/supabase-js';
import { api, ApiError, auth, Catalog, Me, money, Order, Ticket } from './client';
import { AttendeeForm } from './AttendeeForm';
import { EmailSignIn } from './EmailSignIn';
import '../styles/ticketing.css';
import '../styles/panels.css';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { PanelShell } from './PanelShell';
import { AccessibleModal } from './AccessibleModal';
import { AdminPages } from './AdminPages';
import { statusLabel } from './display';
import { NumberInput } from '../components/NumberInput';
import { TicketsSection } from '../components/TicketsSection';

type CheckoutRequest = { selection: string; key: string; orderId?: string };
type CheckoutRecovery = CheckoutRequest & { reason: 'restart' | 'completed' };
type View = 'buy' | 'tickets' | 'orders' | 'scan' | 'transfer' | 'discounts';
const pendingTransferKey = 'takeoff-ticket-transfer';
const checkoutKey = 'takeoff-checkout-request';
function readCheckoutRequest(): CheckoutRequest | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(checkoutKey) || 'null');
    if (typeof value?.selection !== 'string' || typeof value?.key !== 'string' || !/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(value.key)) return null;
    return { selection: value.selection, key: value.key.toLowerCase(), ...(typeof value.orderId === 'string' ? {orderId:value.orderId} : {}) };
  } catch { return null; }
}
function clearConfirmedCheckout(order: Order) {
  const request = readCheckoutRequest();
  if (request && (order.request_key ? request.key === order.request_key.toLowerCase() : request.orderId === order.id)) sessionStorage.removeItem(checkoutKey);
}
function savedCheckoutSelection() {
  try {
    const selection = JSON.parse(readCheckoutRequest()?.selection || 'null');
    if (selection && typeof selection.name === 'string' && typeof selection.email === 'string' && typeof selection.discountCode === 'string' && selection.qty && typeof selection.qty === 'object' && !Array.isArray(selection.qty) && Object.entries(selection.qty).every(([code, count]) => /^[a-z][a-z0-9_]{0,39}$/.test(code) && code !== 'crew' && Number.isInteger(count) && Number(count) >= 0 && Number(count) <= 100)) return selection as { name: string; email: string; discountCode: string; qty: Record<string, number> };
  } catch { /* Ignore unavailable or outdated checkout storage. */ }
  return null;
}
function initialTransfer() {
  const value = new URLSearchParams(location.hash.slice(1)).get('transfer');
  if (value && /^[\da-f-]{72}$/.test(value)) {
    return { token:value, fromLink:true };
  }
  return { token:localStorage.getItem(pendingTransferKey) || '', fromLink:false };
}
export function Ticketing({purchaseOnly=false,onClose}: {purchaseOnly?:boolean;onClose?:()=>void} = {}) {
  const location = useLocation();
  const route = useNavigate();
  const portal = !purchaseOnly && location.pathname !== "/";
  const selectedId = location.pathname.match(/^\/account\/(?:tickets|orders)\/([^/]+)/)?.[1];
  const accountLanding = portal && location.pathname === '/account';
  const editRoute = location.pathname.endsWith("/edit");
  const [transferring, setTransferring] = useState<string|null>(null);
  const [initialInvitation] = useState(initialTransfer);
  const [transfer, setTransfer] = useState(initialInvitation.token);
  const [redirectInvitation, setRedirectInvitation] = useState(initialInvitation.fromLink);
  const orderId = (selectedId && location.pathname.includes('/orders') ? selectedId : new URLSearchParams(location.search).get('order'))?.toLowerCase() || null;
  const [open, setOpen] = useState(false);
  const view: View = portal ? (location.pathname.includes('/orders') ? 'orders' : location.pathname.includes('/transfer') ? 'transfer' : 'tickets') : 'buy';
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(!auth);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [catalogError, setCatalogError] = useState('');
  const [catalogAttempt, setCatalogAttempt] = useState(0);
  const [checkoutStep, setCheckoutStep] = useState<'tickets' | 'details'>('tickets');
  const stepHeading = useRef<HTMLHeadingElement>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const editing = editRoute ? tickets.find(t=>t.id===selectedId)||null : null;
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [order, setOrder] = useState<{ userId:string; data:Order } | null>(null);
  const [awaitingPayment, setAwaitingPayment] = useState(false);
  const [checkoutRestart, setCheckoutRestart] = useState<CheckoutRecovery | null>(null);
  const [savedSelection] = useState(savedCheckoutSelection);
  const [qty, setQty] = useState<Record<string, number>>(savedSelection?.qty || { startup: 0, investor: 0 });
  const [buyerName, setBuyerName] = useState(savedSelection?.name || '');
  const [buyerEmail, setBuyerEmail] = useState(savedSelection?.email || '');
  const [discountCode, setDiscountCode] = useState(savedSelection?.discountCode || '');
  const [quote, setQuote] = useState<{selection:string; code:string; percentage:number; subtotal:number; discountAmount:number; total:number}|null>(null);
  const checkoutSelection = JSON.stringify({ name: buyerName.trim(), email: buyerEmail.trim().toLowerCase(), qty, discountCode });
  const restartAvailable = checkoutRestart?.selection === checkoutSelection;
  const unavailable = catalog ? Object.entries(qty).filter(([code, count]) => count > 0 && !catalog.types.some(t => t.code === code)) : [];
  const canResumeUnavailable = unavailable.length > 0 && readCheckoutRequest()?.selection === checkoutSelection && !restartAvailable;
  const quantity = Object.values(qty).reduce((sum, count) => sum + count, 0);
  const activeOrder = order?.userId === session?.user.id && order?.data.id === orderId ? order.data : null;
  const discountSelection = JSON.stringify({qty,discountCode:discountCode.trim().toUpperCase()});
  const appliedDiscount = quote?.selection === discountSelection ? quote : null;
  const [qr, setQr] = useState<{ id: string; image: string; credential: string } | null>(null);
  const operation = useRef(false);
  const currentUser = useRef(session?.user.id);
  currentUser.current = session?.user.id;
  const reload = useCallback(async () => {
    const requestedUser = currentUser.current;
    const profile = await api<Me>('/me');
    const owned = profile.canAccessTickets ? await api<{ tickets: Ticket[] }>('/me/tickets') : { tickets: [] };
    if (currentUser.current !== requestedUser) return;
    setMe(profile); setTickets(owned.tickets);
    return profile;
  }, []);
  useEffect(() => {
    if (!initialInvitation.fromLink) return;
    localStorage.setItem(pendingTransferKey, initialInvitation.token);
    history.replaceState(null, '', location.pathname + location.search);
  }, [initialInvitation]);
  useEffect(() => {
    if (!auth) return;
    void auth.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const { data } = auth.auth.onAuthStateChange((_event, current) => { setSession(current); setReady(true); });
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => { if (session?.user.email) setBuyerEmail(current => current || session.user.email || ''); }, [session?.user.email]);
  useEffect(() => {
    let canceled = false;
    setCatalogError('');
    void api<Catalog>('/ticket-types').then(result => { if (!canceled) setCatalog(result); }).catch(e => { if (!canceled) setCatalogError(e.message); });
    return () => { canceled = true; };
  }, [open, portal, purchaseOnly, catalogAttempt]);
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => stepHeading.current?.focus(), 0);
    return () => clearTimeout(timer);
  }, [checkoutStep, open]);
  useEffect(() => {
    setMe(null); setTickets([]); setQr(null); setOrder(null);
    if (session && portal) void reload().catch(e => { if (!(orderId && e instanceof ApiError && e.status === 403)) setError(e.message); });
  }, [session?.user.id, portal, reload]);
  // Refresh capabilities before reading an order: a first purchase may still
  // be waiting for its webhook when Checkout redirects an existing account.
  useEffect(() => {
    setAwaitingPayment(false); setOrder(null); setError('');
    if (!session || !portal || !['orders', 'tickets'].includes(view) || !orderId || !/^[\da-f-]{36}$/i.test(orderId)) return;
    let canceled = false;
    let timer: ReturnType<typeof setTimeout>;
    let attempts = 0;
    setAwaitingPayment(true);
    function again() {
      if (canceled) return;
      if (attempts < 20) timer = setTimeout(refresh, 3000);
      else { setAwaitingPayment(false); setNotice('Payment is still processing. Refresh this page to check again.'); }
    }
    async function refresh() {
      attempts++;
      try {
        let profile;
        try { profile = await reload(); }
        catch (failure) {
          // A verified account with no previous tickets can gain access once
          // this payment completes. No order data is read before authorization.
          if (failure instanceof ApiError && failure.status === 403) { again(); return; }
          throw failure;
        }
        if (canceled || !profile) return;
        if (!profile.canAccessOrders) { again(); return; }
        const result = await api<Order>(`/orders/${orderId}`);
        if (canceled) return;
        if (result.id !== orderId) throw new Error('Unable to load this order.');
        setOrder({userId:session!.user.id,data:result});
        if (result.status === 'pending') again();
        else {
          setAwaitingPayment(false);
          if (result.status === 'paid') { clearConfirmedCheckout(result); await reload(); }
        }
      } catch (e) { if (!canceled) { setAwaitingPayment(false); setError((e as Error).message); } }
    }
    void refresh();
    return () => { canceled = true; clearTimeout(timer); };
  }, [session?.user.id, portal, view, orderId, reload]);

  useEffect(()=>{
    if(purchaseOnly)return;
    if(accountLanding&&me) route(me.canAccessTickets?'/account/tickets':me.canAccessOrders?'/account/orders':me.staffRole?'/admin':'/account/tickets',{replace:true});
    if(location.pathname.startsWith('/account/orders')&&me&&!me.canAccessOrders) route('/account/tickets',{replace:true});
    if(location.pathname==='/admin'&&me) route(me.staffRole==='checkin'?'/admin/check-in':'/admin/registrations',{replace:true});
    const query=new URLSearchParams(location.search);
    if(location.pathname==='/'&&(query.get('checkout')==='canceled'||query.get('canceled')==='1')){setCheckoutStep(savedSelection ? 'details' : 'tickets');setOpen(true);setNotice('Payment canceled.');route('/',{replace:true});}
    else if(location.pathname==='/'&&query.has('order')){setOpen(false);route(`/account/tickets?order=${encodeURIComponent(query.get('order')!)}`,{replace:true});}
    else if(location.pathname==='/'&&redirectInvitation&&transfer){setRedirectInvitation(false);setOpen(false);route('/account/transfer',{replace:true});}
    else if(location.pathname==='/'&&query.has('tickets')){setOpen(false);route('/account/tickets',{replace:true});}
  },[location.pathname,location.search,redirectInvitation,transfer,me,route]);
  useEffect(()=>{setQr(null);setTransferring(null);document.getElementById('panel-main')?.focus();},[location.pathname]);
  async function run(fn: () => Promise<unknown>) {
    if (operation.current) return;
    operation.current = true; setBusy(true); setError(''); setNotice('');
    try { await fn(); } catch (e) { setError((e as Error).message); }
    finally { operation.current = false; setBusy(false); }
  }
  function navigate(next: View) { setQr(null); setError(''); setNotice(''); if(next==='buy'){setOpen(true);return;} route(next==='transfer'?'/account/transfer':`/account/${next}`); }
  async function checkout(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (checkoutStep === 'tickets') { setCheckoutStep('details'); return; }
    const name = buyerName.trim();
    const email = buyerEmail.trim().toLowerCase();
    await run(async () => {
      const selection = checkoutSelection;
      setCheckoutRestart(null);
      let request = readCheckoutRequest();
      if (request?.selection !== selection || !/^[\da-f-]{36}$/i.test(request.key)) request = { selection, key: crypto.randomUUID() };
      sessionStorage.setItem(checkoutKey, JSON.stringify(request));
      try {
        const result = await api<{ url: string; orderId?:string }>('/create-checkout', 'POST', { name, email, qty, discountCode, requestKey: request!.key });
        if (result.orderId && readCheckoutRequest()?.key === request!.key) sessionStorage.setItem(checkoutKey, JSON.stringify({...request,orderId:result.orderId}));
        window.location.assign(result.url);
      } catch (failure) {
        if (failure instanceof ApiError && request && ['checkout_restart_required','checkout_already_completed'].includes(failure.code || '')) setCheckoutRestart({...request,reason:failure.code==='checkout_already_completed'?'completed':'restart'});
        throw failure;
      }
    });
  }
  function restartCheckout(event: React.MouseEvent<HTMLButtonElement>) {
    if (!checkoutRestart || operation.current) return;
    const stored = readCheckoutRequest();
    if (stored?.key !== checkoutRestart.key || stored?.selection !== checkoutRestart.selection) {
      setCheckoutRestart(null); setError('Please submit your current selection again.'); return;
    }
    sessionStorage.setItem(checkoutKey, JSON.stringify({ selection: checkoutRestart.selection, key: crypto.randomUUID() }));
    setCheckoutRestart(null); setError('');
    event.currentTarget.form?.requestSubmit();
  }
  function dismissInvitation() {
    localStorage.removeItem(pendingTransferKey); setTransfer(''); setRedirectInvitation(false); setError(''); setNotice(''); route('/',{replace:true});
  }
  function removeUnavailable(code: string) {
    setQty(current => { const next = {...current}; delete next[code]; return next; });
    setQuote(null); setCheckoutRestart(null); setError('');
  }
  const total = catalog?.types.reduce((sum, t) => sum + t.amount * (qty[t.code] || 0), 0) || 0;
  const selectionInvalid = busy || quantity < 1 || quantity > 100 || (!canResumeUnavailable && (total <= 0 || unavailable.length > 0));
  const content = <>
      <div className="ticket-panel" aria-busy={busy}>
      {portal && !auth ? <p>Ticketing unavailable.</p> : portal && !ready ? <p>Loading sign-in…</p> : portal && !session ? <>
        <h1>{accountLanding ? 'Your account' : location.pathname.startsWith('/admin') ? 'Administration' : view === 'orders' ? 'Orders' : view === 'transfer' ? 'Accept ticket' : 'My tickets'}</h1>
        {!location.pathname.startsWith('/admin') && view !== 'transfer' && <nav className="sign-in-options" aria-label="Sign-in options"><NavLink to="/account/tickets">My tickets</NavLink><NavLink to="/account/orders">Orders</NavLink></nav>}
        {!accountLanding && <EmailSignIn key={`${location.pathname}:${transfer}`} client={auth!} purpose={location.pathname.startsWith('/admin') ? 'admin' : view === 'transfer' ? 'transfer' : view === 'orders' ? 'orders' : 'tickets'} transferToken={transfer} />}
      </> : portal && !me ? <p role={awaitingPayment?'status':undefined}>{awaitingPayment?'Awaiting payment confirmation.':error ? 'Unable to open this account.' : 'Checking ticket access…'}</p> : <>
        {portal && (!location.pathname.startsWith('/admin')||!me?.staffRole) && <h1>{location.pathname.startsWith('/admin')?'Administration':view==='orders'?'Orders':view==='transfer'?'Accept ticket':'My tickets'}</h1>}
        {portal && awaitingPayment && <p role="status" className="ticket-notice">Awaiting payment confirmation.</p>}
        {portal && location.pathname.startsWith('/admin') ? (me ? me.staffRole ? <AdminPages role={me.staffRole}/> : <p role="alert">You do not have permission to access administration.</p> : <p>Loading permissions…</p>) : <>

        {view === 'buy' && <form className="ticket-form checkout-form" onSubmit={checkout}>
          {catalogError ? <div role="alert"><p>{catalogError}</p><TakeoffButton type="button" variant="secondary" onClick={()=>setCatalogAttempt(current=>current+1)}>Try again</TakeoffButton></div> : !catalog ? <p role="status">Loading ticket availability…</p> : !catalog.salesEnabled || (!catalog.types.length && !unavailable.length) ? <p>Ticket sales are not open yet.</p> : <>
          <h3 ref={stepHeading} tabIndex={-1} className="checkout-step">{checkoutStep === 'tickets' ? '1. Select tickets' : '2. Buyer details'}</h3>
          {checkoutStep === 'tickets' ? <>
          {catalog.types.map(t => <div className={`ticket-quantity${qty[t.code] > 0 ? ' ticket-quantity--picked' : ''}`} key={t.code}><span>{t.label}<small>{money(t.amount, t.currency)} per ticket</small></span><NumberInput compact label={`${t.label} quantity`} min={0} max={100} step={1} value={qty[t.code] || 0} disabled={busy} onValueChange={value => setQty(current => ({ ...current, [t.code]: Number(value) }))} /></div>)}
          {!!unavailable.length&&<section className="checkout-unavailable"><h3>Unavailable tickets</h3>{unavailable.map(([code,count])=><div className="page-heading" key={code}><span>{statusLabel(code)} × {count}</span><TakeoffButton type="button" variant="ghost" disabled={busy} aria-label={`Remove ${statusLabel(code)}`} onClick={()=>removeUnavailable(code)}>Remove</TakeoffButton></div>)}</section>}
          </> : <>
          <section className="checkout-summary" aria-label="Selected tickets">
            {Object.entries(qty).filter(([, count]) => count > 0).map(([code, count]) => <p key={code}>{catalog.types.find(t=>t.code===code)?.label || statusLabel(code)} × {count}</p>)}
            <TakeoffButton type="button" variant="ghost" disabled={busy} onClick={()=>setCheckoutStep('tickets')}>Edit tickets</TakeoffButton>
          </section>
          <label>Buyer’s full name<TakeoffInput name="name" value={buyerName} onChange={e => setBuyerName(e.target.value)} maxLength={200} required autoComplete="name" /></label>
          <label>Buyer’s email<TakeoffInput type="email" name="email" value={buyerEmail} onChange={e => setBuyerEmail(e.target.value)} maxLength={254} required autoComplete="email" /></label>
          <details className="checkout-discount" open={savedSelection?.discountCode?true:undefined}><summary>Discount code</summary><div className="ticket-form"><label>Discount code<TakeoffInput value={discountCode} onChange={e=>setDiscountCode(e.target.value.toUpperCase())} maxLength={40} /></label>
          <div className="ticket-actions"><TakeoffButton type="button" variant="secondary" disabled={busy||!discountCode.trim()||total<=0} onClick={()=>void run(async()=>{
            const selection=discountSelection;
            const result=await api<{code:string;percentage:number;subtotal:number;discountAmount:number;total:number}>('/discounts/quote','POST',{qty,discountCode});
            setQuote({...result,selection});
          })}>Apply code</TakeoffButton>{discountCode&&<TakeoffButton type="button" variant="ghost" onClick={()=>{setDiscountCode('');setQuote(null);}}>Remove code</TakeoffButton>}</div>
          </div></details>
          {appliedDiscount&&<p className="discount-saving">{appliedDiscount.code}: {appliedDiscount.percentage}% off eligible tickets · Saving {money(appliedDiscount.discountAmount)}</p>}
          {restartAvailable&&error&&<div className="ticket-error" role="alert"><p>{error}</p>{checkoutRestart?.reason==='completed'&&<Link to="/account">View purchases</Link>}</div>}
          </>}
          <div className="checkout-footer">
            <p>{canResumeUnavailable ? 'Total at checkout' : 'Total'} {!canResumeUnavailable && <strong>{money(appliedDiscount?.total ?? total)}</strong>}</p>
            {checkoutStep === 'tickets' ? <div className="checkout-navigation">
              <TakeoffButton type="button" variant="secondary" onClick={()=>{setOpen(false);onClose?.();}}>Cancel</TakeoffButton>
              <TakeoffButton variant="cyan" type="submit" disabled={selectionInvalid}>Continue</TakeoffButton>
            </div> : <TakeoffButton variant="cyan" type={restartAvailable ? 'button' : 'submit'} onClick={restartAvailable ? restartCheckout : undefined} disabled={selectionInvalid}>
              {busy ? 'Preparing checkout…' : restartAvailable ? checkoutRestart?.reason === 'completed' ? 'Buy again' : 'Restart payment' : canResumeUnavailable ? 'Resume payment' : 'Continue to secure payment'}
            </TakeoffButton>}
          </div>
          </>}
        </form>}
        {view === 'tickets' && !me?.canAccessTickets && !awaitingPayment && <section className="empty-state"><p>No tickets are associated with this account.</p>{me?.canAccessOrders && <Link to="/account/orders">View your orders</Link>}</section>}
        {view === 'tickets' && me?.canAccessTickets && (editing && catalog ? <AttendeeForm key={editing.id} ticket={editing} catalog={catalog} onSaved={() => { route(`/account/tickets/${editing.id}`); void run(reload); }} onCancel={() => route(`/account/tickets/${editing.id}`)} /> : <section>
          {activeOrder && ['failed', 'expired'].includes(activeOrder.status) && <p role="status">Payment was not completed. <Link to="/">Return to registration</Link> to try again.</p>}
          {!tickets.length && !awaitingPayment && <p>No tickets in this account yet.</p>}
          {selectedId&&<Link to="/account/tickets">← Back to tickets</Link>}
          {selectedId&&!tickets.some(t=>t.id===selectedId)&&<p>Ticket not found in this account.</p>}
          <div className={selectedId?'ticket-detail-grid':'ticket-grid'}>{tickets.filter(t=>!selectedId||t.id===selectedId).map(t => <TakeoffCard key={t.id} className="ticket-card"><div className="page-heading"><h3>{t.label}</h3><TakeoffBadge variant={t.status==='active'?'success':t.status==='revoked'?'danger':'warning'}>{statusLabel(t.status)}</TakeoffBadge></div><small className="ticket-reference">Ticket {t.id.slice(0,8)}</small>
            <p className="ticket-holder">{t.attendee?.full_name || 'Attendee details needed'}</p>{t.used&&<small>Transfers closed after check-in</small>}
            {!selectedId&&<Link className="takeoff-button takeoff-button--cyan ticket-view" to={`/account/tickets/${t.id}`}>View ticket</Link>}
            {selectedId && t.status === 'active' && <>
              <div className="ticket-actions"><TakeoffButton variant={t.attendee?"secondary":"cyan"} size="sm" disabled={t.used || busy} onClick={() => { route(`/account/tickets/${t.id}/edit`); setQr(null); }}>Attendee details</TakeoffButton>
              <TakeoffButton variant={t.attendee?"cyan":"secondary"} size="sm" disabled={!t.attendee || busy} title={!t.attendee?"Save attendee details to unlock QR":undefined} onClick={() => void run(async () => {
                const result = await api<{ credential: string }>(`/tickets/${t.id}/qr`);
                const QRCode = await import('qrcode');
                const image = await QRCode.toDataURL(result.credential, { width: 320, margin: 3, errorCorrectionLevel: 'M' });
                setQr({ id: t.id, image, credential: result.credential });
              })}>Show QR</TakeoffButton></div>
              {qr?.id === t.id && <div className="ticket-qr"><img src={qr.image} alt={`Admission QR for ${t.attendee?.full_name}`} /><details><summary>Manual check-in credential</summary><code>{qr.credential}</code></details></div>}
              {t.transfer && <div><p>Transfer pending to {t.transfer.email} until {new Date(t.transfer.expires_at).toLocaleString()}.</p><TakeoffButton variant="ghost" disabled={busy} onClick={() => void run(async () => { await api(`/transfers/${t.transfer!.id}`, 'DELETE'); await reload(); })}>Cancel transfer</TakeoffButton></div>}
              {t.transferable && !t.transfer && <TakeoffButton className="ticket-transfer-action" variant="ghost" onClick={()=>setTransferring(t.id)}>Transfer ticket</TakeoffButton>}
              <AccessibleModal isOpen={transferring===t.id} onClose={()=>setTransferring(null)} title="Transfer ticket">{t.transferable && !t.transfer && <form className="ticket-transfer ticket-form" onSubmit={e => {
                e.preventDefault(); const email = String(new FormData(e.currentTarget).get('email') || '');
                void run(async () => { await api(`/tickets/${t.id}/transfers`, 'POST', { email }); setTransferring(null); await reload(); setNotice('Transfer invitation queued for email delivery. You keep the ticket until it is accepted.'); });
              }}><label>Transfer this ticket to<TakeoffInput type="email" name="email" required maxLength={254} placeholder="recipient@example.com" /></label><TakeoffButton type="submit" variant="secondary" size="sm" disabled={busy}>Send invitation</TakeoffButton></form>}</AccessibleModal>
            </>}
          </TakeoffCard>)}</div>
        </section>)}
        {view === 'orders' && me?.canAccessOrders && <section>{selectedId&&<Link to="/account/orders">← Back to orders</Link>}
          {selectedId&&!activeOrder&&!error&&<p>Loading order…</p>}{selectedId&&activeOrder && <div className="ticket-card"><h4>Order {activeOrder.id.slice(0,8)} · {activeOrder.status}</h4>{activeOrder.discount_code&&<p>{activeOrder.discount_code} · Saved {money(activeOrder.discount_amount||0)} ({activeOrder.discount_percentage}%)</p>}{activeOrder.items?.map(i => <p key={i.id}>{i.quantity} × {i.label} · {money(i.unit_amount)} each</p>)}{activeOrder.tickets?.map(t => <p key={t.id}>Ticket {t.id.slice(0,8)}: {t.status} · {t.held_by_buyer ? 'In your account' : 'Transferred'}</p>)}</div>}
          {!selectedId&&me?.orders.map(o => <button className="ticket-order" key={o.id} onClick={() => route(`/account/orders/${o.id}`)}>{new Date(o.created_at).toLocaleDateString()} · <span className="order-status">{statusLabel(o.status)}</span><strong>{money(o.total_amount)}</strong><span className="order-reference">{o.id.slice(0,8)}</span></button>)}
          {!me?.orders.length && <p>No purchases yet.</p>}
        </section>}
        {view === 'transfer' && transfer && <section className="ticket-form"><p>Accepting replaces the previous holder’s access.</p><TakeoffButton variant="cyan" disabled={busy} onClick={() => void run(async () => {
          await api(`/transfers/${transfer}/accept`, 'POST', {}); localStorage.removeItem(pendingTransferKey); setTransfer(''); navigate('tickets'); await reload(); setNotice('Ticket accepted. Complete your attendee details to receive your QR code.');
        })}>Accept ticket</TakeoffButton></section>}
        </>}
      </>}
      {portal&&view==='transfer'&&<TakeoffButton variant="ghost" onClick={dismissInvitation}>Dismiss invitation</TakeoffButton>}
      {notice && <p role="status" className="ticket-notice">{notice}</p>}
      {error && !restartAvailable && <p role="alert" className="ticket-error">{error}</p>}
      {portal && catalogError && <p role="alert" className="ticket-error">{catalogError}</p>}
      </div>
  </>;
  if(purchaseOnly)return <>{content}<TakeoffButton variant="ghost" onClick={onClose}>Close</TakeoffButton></>;
  if(portal)return <PanelShell me={me} email={session?.user.email} signOut={()=>void run(async()=>{await auth!.auth.signOut();setSession(null);})}>{content}</PanelShell>;
  return <><TicketsSection catalog={catalog} error={catalogError} onRetry={()=>setCatalogAttempt(current=>current+1)} hasSelection={quantity>0} onPurchase={()=>{setCheckoutStep('tickets');setOpen(true);}}/>
   <AccessibleModal isOpen={open} onClose={()=>setOpen(false)} title="Buy tickets">{content}</AccessibleModal></>;

}

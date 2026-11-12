begin;
create schema if not exists ticketing_private;
revoke all on schema ticketing_private from public, anon, authenticated;
grant usage on schema ticketing_private to service_role;
revoke create on schema public from public, anon, authenticated;
-- Apply once to a NEW Supabase project. All ticket writes use service-only RPCs.
create extension if not exists pgcrypto;

create table public.events (
 id uuid primary key default gen_random_uuid(), slug text not null unique,
 name text not null, timezone text not null default 'Asia/Tokyo',
 starts_at timestamptz not null, ends_at timestamptz not null,
 sales_enabled boolean not null default false, check(ends_at > starts_at)
);
create table public.event_days (
 id uuid primary key default gen_random_uuid(), event_id uuid not null references public.events,
 day date not null, unique(event_id,day)
);
create table public.currencies (code text primary key, decimals integer not null check(decimals between 0 and 3));
insert into public.currencies values ('JPY',0),('USD',2),('EUR',2),('GBP',2);
create table public.ticket_types (
 id uuid primary key default gen_random_uuid(), event_id uuid not null references public.events,
 code text not null check(code in ('startup','investor','crew')), label text not null,
 public_purchase boolean not null default true, transferable boolean not null default true,
 unique(event_id,code), check(code <> 'crew' or (not public_purchase and not transferable))
);
create table public.ticket_prices (
 id uuid primary key default gen_random_uuid(), ticket_type_id uuid not null references public.ticket_types,
 amount bigint not null check(amount > 0), currency text not null references public.currencies,
 stripe_price_id text not null unique, active boolean not null default false,
 created_at timestamptz not null default now(), check(currency = 'JPY')
);
create unique index one_active_price on public.ticket_prices(ticket_type_id) where active;
create table public.orders (
 id uuid primary key default gen_random_uuid(), event_id uuid not null references public.events,
 buyer_id uuid not null references auth.users, buyer_name text not null, buyer_email text not null,
 status text not null default 'pending' check(status in ('pending','paid','failed','expired','refunded','needs_review')),
 total_amount bigint not null check(total_amount > 0), currency text not null default 'JPY',
 request_key uuid not null, request_data jsonb not null,
 stripe_session_id text unique, stripe_payment_intent_id text unique, checkout_url text,
 created_at timestamptz not null default now(), paid_at timestamptz,
 unique(buyer_id,request_key)
);
create table public.order_items (
 id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders,
 ticket_type_id uuid not null references public.ticket_types, price_id uuid not null references public.ticket_prices,
 quantity integer not null check(quantity between 1 and 100), unit_amount bigint not null check(unit_amount > 0),
 label text not null, stripe_price_id text not null, unique(order_id,ticket_type_id)
);
create table public.event_staff (
 event_id uuid not null references public.events, user_id uuid not null references auth.users,
 role text not null check(role in ('admin','checkin')), primary key(event_id,user_id)
);
create table public.tickets (
 id uuid primary key default gen_random_uuid(), event_id uuid not null references public.events,
 ticket_type_id uuid not null references public.ticket_types, order_item_id uuid references public.order_items,
 item_sequence integer, holder_id uuid not null references auth.users,
 status text not null default 'active' check(status in ('active','suspended','revoked')),
 issuance_source text not null check(issuance_source in ('purchase','crew')),
 issued_by uuid references auth.users, created_at timestamptz not null default now(),
 unique(order_item_id,item_sequence),
 check((issuance_source='purchase' and order_item_id is not null and item_sequence > 0) or
       (issuance_source='crew' and order_item_id is null and item_sequence is null and issued_by is not null))
);
create index tickets_holder on public.tickets(holder_id);
create table public.ticket_attendees (
 ticket_id uuid primary key references public.tickets, full_name text not null check(length(trim(full_name)) between 1 and 200),
 email text not null, company text, role text, updated_at timestamptz not null default now()
);
create table public.startup_profiles (
 ticket_id uuid primary key references public.tickets, business_description text,
 funding_amount bigint check(funding_amount >= 0), funding_currency text references public.currencies,
 funding_stage text check(funding_stage in ('pre_seed','seed','series_a','series_b','series_c_plus','other')),
 target_vc_types text, check(funding_amount is null or funding_currency is not null)
);
create table public.investor_profiles (
 ticket_id uuid primary key references public.tickets,
 investment_min bigint check(investment_min >= 0), investment_max bigint check(investment_max >= 0),
 investment_currency text references public.currencies,
 leads_deals boolean, invests_internationally boolean, seeking_lps boolean,
 other_sector text,
 check(investment_min is null or investment_max is null or investment_min <= investment_max),
 check((investment_min is null and investment_max is null) or investment_currency is not null)
);
create table public.sectors (code text primary key, label text not null);
insert into public.sectors values ('all','All sectors'),('deep_tech_ai','Deep Tech / AI'),('fintech','Fintech'),
 ('saas_b2b','SaaS / B2B Software'),('consumer','Consumer / E-commerce'),('health','Biotech / Healthtech'),
 ('climate','Climate / Sustainability'),('gaming','Gaming / Entertainment'),('other','Other');
create table public.investor_profile_sectors (
 ticket_id uuid not null references public.investor_profiles on delete cascade,
 sector_code text not null references public.sectors, primary key(ticket_id,sector_code)
);
create table public.ticket_credentials (
 id uuid primary key default gen_random_uuid(), ticket_id uuid not null references public.tickets,
 version integer not null, token_hash text not null unique, issued_at timestamptz not null default now(),
 revoked_at timestamptz, unique(ticket_id,version)
);
create unique index one_active_credential on public.ticket_credentials(ticket_id) where revoked_at is null;
create table public.ticket_transfers (
 id uuid primary key default gen_random_uuid(), ticket_id uuid not null references public.tickets,
 sender_id uuid not null references auth.users, recipient_email text not null,
 token_hash text not null unique, status text not null default 'pending'
 check(status in ('pending','accepted','canceled','expired')),
 expires_at timestamptz not null, accepted_by uuid references auth.users,
 created_at timestamptz not null default now(), accepted_at timestamptz
);
create unique index one_pending_transfer on public.ticket_transfers(ticket_id) where status='pending';
create table public.ticket_checkins (
 id uuid primary key default gen_random_uuid(), ticket_id uuid not null references public.tickets,
 event_day_id uuid not null references public.event_days, staff_id uuid not null references auth.users,
 checked_in_at timestamptz not null default now(), unique(ticket_id,event_day_id)
);
create table public.stripe_events (id text primary key, type text not null, processed_at timestamptz not null default now());
create table public.email_outbox (
 id uuid primary key default gen_random_uuid(), dedupe_key text not null unique, recipient text not null,
 template text not null check(template in ('purchase','transfer','accepted','crew')),
 payload jsonb not null default '{}', status text not null default 'pending' check(status in ('pending','sending','sent','failed')),
 attempts integer not null default 0, available_at timestamptz not null default now(),
 lease_token uuid, last_error text, created_at timestamptz not null default now(), sent_at timestamptz
);
create index email_outbox_due on public.email_outbox(available_at) where status in ('pending','sending');

-- Fail closed: browsers have no direct table or RPC access. Backend verifies Supabase JWTs.
do $$ declare r record; begin
 for r in select tablename from pg_tables where schemaname='public' loop
  execute format('alter table public.%I enable row level security', r.tablename);
  execute format('revoke all on public.%I from anon, authenticated', r.tablename);
 end loop;
end $$;

insert into public.events(slug,name,starts_at,ends_at) values
 ('takeoff-tokyo-2027','Takeoff Tokyo 2027','2027-03-17 09:00+09','2027-03-18 23:59:59+09');
insert into public.event_days(event_id,day) select id,d from public.events cross join
 (values ('2027-03-17'::date),('2027-03-18'::date)) x(d);
insert into public.ticket_types(event_id,code,label,public_purchase,transferable)
 select id,code,label,is_public,is_public from public.events cross join
 (values ('startup','Startup',true),('investor','Investor',true),('crew','Crew',false)) x(code,label,is_public);

-- Centralized business operations: a service-only transaction per request.
create function ticketing_private.ticket_command(p_action text, p_user uuid, p_data jsonb default '{}')
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare
 ev events; usr auth.users; ord orders; tk tickets; typ ticket_types; tr ticket_transfers;
 credential ticket_credentials; item record; result jsonb; total bigint := 0; qty integer;
 current_day uuid; scan ticket_checkins; staff_role text; token text; oid uuid; profile jsonb;
begin
 select * into ev from events where slug='takeoff-tokyo-2027';
 if p_action='catalog' then
  return jsonb_build_object('salesEnabled',ev.sales_enabled and now()<ev.starts_at,
   'types',coalesce((select jsonb_agg(jsonb_build_object('code',tt.code,'label',tt.label,'amount',pp.amount,'currency',pp.currency))
   from ticket_types tt join ticket_prices pp on pp.ticket_type_id=tt.id and pp.active
   where tt.event_id=ev.id and tt.public_purchase),'[]'::jsonb),
   'sectors',(select jsonb_agg(to_jsonb(s)) from sectors s),
   'currencies',(select jsonb_agg(to_jsonb(c)) from currencies c));
 end if;
 select * into usr from auth.users where id=p_user and email_confirmed_at is not null;
 if usr.id is null then raise exception 'Verified sign-in required' using errcode='28000'; end if;
 select role into staff_role from event_staff where event_id=ev.id and user_id=p_user;
 if p_action='me' then
  return jsonb_build_object('email',usr.email,'staffRole',staff_role,
   'orders',coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'status',o.status,'total_amount',o.total_amount,'created_at',o.created_at) order by o.created_at desc)
      from orders o where buyer_id=p_user and event_id=ev.id),'[]'::jsonb));
 elsif p_action='order:create' then
  if not ev.sales_enabled or now()>=ev.starts_at then raise exception 'Sales are not open'; end if;
  if length(trim(coalesce(p_data->>'name',''))) not between 1 and 200 then raise exception 'Buyer name required'; end if;
  -- Serialize retries by buyer/request key, including simultaneous first requests.
  perform pg_advisory_xact_lock(hashtextextended(p_user::text || (p_data->>'requestKey'),0));
  select * into ord from orders where buyer_id=p_user and request_key=(p_data->>'requestKey')::uuid;
  if ord.id is not null then
   if ord.request_data<>p_data then raise exception 'Idempotency key already used for another selection'; end if;
  else
   if jsonb_typeof(p_data->'qty')<>'object' or not (p_data->'qty' ?| array['startup','investor']) then raise exception 'Select tickets'; end if;
   if exists(select 1 from jsonb_object_keys(p_data->'qty') k where k not in ('startup','investor')) then raise exception 'Invalid ticket type'; end if;
   qty:=0;
   for item in select key,value from jsonb_each_text(p_data->'qty') loop
    if item.value !~ '^[0-9]{1,3}$' then raise exception 'Invalid quantity'; end if;
    qty:=qty+item.value::integer;
    if item.value::integer>100 then raise exception 'Maximum 100 tickets'; end if;
    if item.value::integer=0 then continue; end if;
    select pp.amount into total from ticket_prices pp join ticket_types tt on tt.id=pp.ticket_type_id
      where tt.event_id=ev.id and tt.code=item.key and tt.public_purchase and pp.active;
    if not found then raise exception 'Ticket price not configured'; end if;
   end loop;
   if qty not between 1 and 100 then raise exception 'Select 1–100 tickets'; end if;
   select sum(pp.amount*(p_data->'qty'->>tt.code)::integer) into total
    from ticket_types tt join ticket_prices pp on pp.ticket_type_id=tt.id and pp.active
    where tt.event_id=ev.id and tt.public_purchase and coalesce((p_data->'qty'->>tt.code)::integer,0)>0;
   insert into orders(event_id,buyer_id,buyer_name,buyer_email,total_amount,request_key,request_data)
    values(ev.id,p_user,trim(p_data->>'name'),usr.email,total,(p_data->>'requestKey')::uuid,p_data) returning * into ord;
   insert into order_items(order_id,ticket_type_id,price_id,quantity,unit_amount,label,stripe_price_id)
    select ord.id,tt.id,pp.id,(p_data->'qty'->>tt.code)::integer,pp.amount,tt.label,pp.stripe_price_id
    from ticket_types tt join ticket_prices pp on pp.ticket_type_id=tt.id and pp.active
    where tt.event_id=ev.id and tt.public_purchase and coalesce((p_data->'qty'->>tt.code)::integer,0)>0;
  end if;
  return to_jsonb(ord)||jsonb_build_object('items',(select jsonb_agg(to_jsonb(i)) from order_items i where order_id=ord.id));
 elsif p_action in ('order:link','order:get') then
  select * into ord from orders where id=(p_data->>'id')::uuid and buyer_id=p_user for update;
  if not found then raise exception 'Order not found' using errcode='P0002'; end if;
  if p_action='order:link' then
   if ord.stripe_session_id is not null and ord.stripe_session_id<>p_data->>'sessionId' then raise exception 'Checkout session mismatch'; end if;
   update orders set stripe_session_id=p_data->>'sessionId',checkout_url=p_data->>'url' where id=ord.id returning * into ord;
  end if;
  return (to_jsonb(ord)-'request_data')||jsonb_build_object('items',(select jsonb_agg(to_jsonb(i)) from order_items i where order_id=ord.id),
   'tickets',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'status',t.status,'held_by_buyer',t.holder_id=p_user))
   from tickets t join order_items i on i.id=t.order_item_id where i.order_id=ord.id),'[]'::jsonb));
 elsif p_action='tickets:list' then
  return coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'status',t.status,'type',tt.code,'label',tt.label,
   'attendee',(select to_jsonb(a)-'ticket_id' from ticket_attendees a where ticket_id=t.id),
   'startup',(select to_jsonb(s)-'ticket_id' from startup_profiles s where ticket_id=t.id),
   'investor',(select (to_jsonb(i)-'ticket_id')||jsonb_build_object('sectors',coalesce((select jsonb_agg(sector_code) from investor_profile_sectors where ticket_id=t.id),'[]'::jsonb)) from investor_profiles i where ticket_id=t.id),
   'used',exists(select 1 from ticket_checkins where ticket_id=t.id),
   'transferable',tt.transferable and now()<ev.starts_at and not exists(select 1 from ticket_checkins where ticket_id=t.id),
   'transfer',(select jsonb_build_object('id',x.id,'email',x.recipient_email,'expires_at',x.expires_at) from ticket_transfers x where ticket_id=t.id and x.status='pending' and expires_at>now())) order by t.created_at)
   from tickets t join ticket_types tt on tt.id=t.ticket_type_id where t.holder_id=p_user and t.event_id=ev.id),'[]'::jsonb);
 elsif p_action='admin:list' then
  if staff_role<>'admin' or staff_role is null then raise exception 'Admin required' using errcode='42501'; end if;
  return coalesce((select jsonb_agg(to_jsonb(x)) from (
   select t.*,tt.code,a.full_name,a.email from tickets t join ticket_types tt on tt.id=t.ticket_type_id
   left join ticket_attendees a on a.ticket_id=t.id where t.event_id=ev.id
   and (coalesce(p_data->>'type','')='' or tt.code=p_data->>'type')
   and (coalesce(p_data->>'status','')='' or t.status=p_data->>'status')
   order by t.created_at desc,t.id limit 100 offset greatest(0,coalesce((p_data->>'offset')::integer,0))) x),'[]'::jsonb);
 elsif p_action='crew:create' then
  if staff_role<>'admin' or staff_role is null then raise exception 'Admin required' using errcode='42501'; end if;
  -- Use an existing verified account. Crew onboarding UI is deliberately omitted.
  select id into oid from auth.users where lower(email)=lower(p_data->>'email') and email_confirmed_at is not null;
  if oid is null then raise exception 'Recipient must sign in once before Crew issuance'; end if;
  if length(trim(coalesce(p_data->>'name',''))) not between 1 and 200 then raise exception 'Name required'; end if;
  select * into typ from ticket_types where event_id=ev.id and code='crew';
  insert into tickets(event_id,ticket_type_id,holder_id,issuance_source,issued_by)
   values(ev.id,typ.id,oid,'crew',p_user) returning * into tk;
  insert into ticket_attendees(ticket_id,full_name,email) values(tk.id,trim(p_data->>'name'),lower(p_data->>'email'));
  insert into email_outbox(dedupe_key,recipient,template,payload) values('crew:'||tk.id,p_data->>'email','crew',jsonb_build_object('ticketId',tk.id));
  return to_jsonb(tk);
 end if;

 if p_action='transfer:accept' then
  -- Lock order: ticket first, then transfer, as used by scan/revoke/transfer endpoints.
  select ticket_id into oid from ticket_transfers where token_hash=p_data->>'tokenHash';
 elsif p_action='transfer:cancel' then
  select ticket_id into oid from ticket_transfers where id=(p_data->>'transferId')::uuid;
 elsif p_action='checkin' then
  select ticket_id into oid from ticket_credentials where token_hash=p_data->>'tokenHash';
 else oid:=(p_data->>'id')::uuid;
 end if;
 select * into tk from tickets where id=oid and event_id=ev.id for update;
 if not found then raise exception 'Ticket not found' using errcode='P0002'; end if;
 select * into typ from ticket_types where id=tk.ticket_type_id;
 if p_action='ticket:revoke' then
  if staff_role<>'admin' or staff_role is null then raise exception 'Admin required' using errcode='42501'; end if;
  update tickets set status='revoked' where id=tk.id;
  update ticket_credentials set revoked_at=now() where ticket_id=tk.id and revoked_at is null;
  update ticket_transfers set status='canceled' where ticket_id=tk.id and status='pending';
  return jsonb_build_object('revoked',true);
 end if;
 if tk.status<>'active' then raise exception 'Ticket is not active'; end if;
 if p_action='checkin' then
  if staff_role is null then raise exception 'Staff authorization required' using errcode='42501'; end if;
  if not exists(select 1 from ticket_credentials where ticket_id=tk.id and token_hash=p_data->>'tokenHash' and revoked_at is null) then raise exception 'QR code has been revoked'; end if;
  if not exists(select 1 from ticket_attendees where ticket_id=tk.id) then raise exception 'Attendee profile incomplete'; end if;
  select id into current_day from event_days where event_id=ev.id and day=(now() at time zone ev.timezone)::date;
  if current_day is null then raise exception 'No admission scheduled today'; end if;
  select * into scan from ticket_checkins where ticket_id=tk.id and event_day_id=current_day;
  if scan.id is not null then return jsonb_build_object('admitted',false,'alreadyCheckedIn',true,'checkedInAt',scan.checked_in_at); end if;
  insert into ticket_checkins(ticket_id,event_day_id,staff_id) values(tk.id,current_day,p_user) returning * into scan;
  update ticket_transfers set status='canceled' where ticket_id=tk.id and status='pending';
  return jsonb_build_object('admitted',true,'checkedInAt',scan.checked_in_at,'type',typ.label,'name',(select full_name from ticket_attendees where ticket_id=tk.id));
 elsif p_action='transfer:accept' then
  select * into tr from ticket_transfers where token_hash=p_data->>'tokenHash' for update;
  if tr.status<>'pending' or tr.expires_at<=now() or now()>=ev.starts_at then raise exception 'Transfer unavailable or expired'; end if;
  if lower(usr.email)<>lower(tr.recipient_email) then raise exception 'Sign in with the invited email' using errcode='42501'; end if;
  if tk.holder_id<>tr.sender_id or exists(select 1 from ticket_checkins where ticket_id=tk.id) then raise exception 'Ticket cannot be transferred'; end if;
  update ticket_transfers set status='accepted',accepted_by=p_user,accepted_at=now() where id=tr.id;
  update tickets set holder_id=p_user where id=tk.id;
  update ticket_credentials set revoked_at=now() where ticket_id=tk.id and revoked_at is null;
  delete from startup_profiles where ticket_id=tk.id;
  delete from investor_profiles where ticket_id=tk.id;
  delete from ticket_attendees where ticket_id=tk.id;
  insert into email_outbox(dedupe_key,recipient,template,payload)
   select 'accepted:'||tr.id||':'||u.id,u.email,'accepted',jsonb_build_object('ticketId',tk.id) from auth.users u where id in (p_user,tr.sender_id);
  return jsonb_build_object('ticketId',tk.id);
 end if;
 if tk.holder_id<>p_user then raise exception 'Ticket belongs to another holder' using errcode='42501'; end if;
 if p_action='attendee:save' then
  if exists(select 1 from ticket_checkins where ticket_id=tk.id) then raise exception 'Profile cannot change after admission'; end if;
  if length(trim(coalesce(p_data->>'name',''))) not between 1 and 200 then raise exception 'Name required'; end if;
  insert into ticket_attendees(ticket_id,full_name,email,company,role)
   values(tk.id,trim(p_data->>'name'),usr.email,nullif(p_data->>'company',''),nullif(p_data->>'role',''))
   on conflict(ticket_id) do update set full_name=excluded.full_name,email=excluded.email,company=excluded.company,role=excluded.role,updated_at=now();
  profile:=coalesce(p_data->'profile','{}');
  if typ.code='startup' then
   insert into startup_profiles(ticket_id,business_description,funding_amount,funding_currency,funding_stage,target_vc_types)
    values(tk.id,profile->>'business_description',(profile->>'funding_amount')::bigint,profile->>'funding_currency',nullif(profile->>'funding_stage',''),profile->>'target_vc_types')
    on conflict(ticket_id) do update set business_description=excluded.business_description,funding_amount=excluded.funding_amount,funding_currency=excluded.funding_currency,funding_stage=excluded.funding_stage,target_vc_types=excluded.target_vc_types;
  elsif typ.code='investor' then
   insert into investor_profiles(ticket_id,investment_min,investment_max,investment_currency,leads_deals,invests_internationally,seeking_lps,other_sector)
    values(tk.id,(profile->>'investment_min')::bigint,(profile->>'investment_max')::bigint,profile->>'investment_currency',
    (profile->>'leads_deals')::boolean,(profile->>'invests_internationally')::boolean,(profile->>'seeking_lps')::boolean,profile->>'other_sector')
    on conflict(ticket_id) do update set investment_min=excluded.investment_min,investment_max=excluded.investment_max,investment_currency=excluded.investment_currency,
    leads_deals=excluded.leads_deals,invests_internationally=excluded.invests_internationally,seeking_lps=excluded.seeking_lps,other_sector=excluded.other_sector;
   delete from investor_profile_sectors where ticket_id=tk.id;
   insert into investor_profile_sectors select tk.id,v from jsonb_array_elements_text(coalesce(profile->'sectors','[]')) v;
  end if;
  return jsonb_build_object('saved',true);
 elsif p_action='qr' then
  if not exists(select 1 from ticket_attendees where ticket_id=tk.id) then raise exception 'Complete your attendee details first'; end if;
  select * into credential from ticket_credentials where ticket_id=tk.id and revoked_at is null;
  if not found then
   oid:=gen_random_uuid();
   insert into ticket_credentials(id,ticket_id,version,token_hash)
    values(oid,tk.id,(select coalesce(max(version),0)+1 from ticket_credentials where ticket_id=tk.id),encode(digest(oid::text,'sha256'),'hex')) returning * into credential;
  end if;
  return jsonb_build_object('credentialId',credential.id);
 elsif p_action='transfer:create' then
  if not typ.transferable or now()>=ev.starts_at or exists(select 1 from ticket_checkins where ticket_id=tk.id) then raise exception 'Ticket cannot be transferred'; end if;
  if lower(usr.email)=lower(p_data->>'email') then raise exception 'Choose a different recipient'; end if;
  update ticket_transfers set status='expired' where ticket_id=tk.id and status='pending' and expires_at<=now();
  if exists(select 1 from ticket_transfers where ticket_id=tk.id and status='pending') then raise exception 'Cancel the pending transfer first'; end if;
  insert into ticket_transfers(ticket_id,sender_id,recipient_email,token_hash,expires_at)
   values(tk.id,p_user,lower(p_data->>'email'),p_data->>'tokenHash',least(now()+interval '72 hours',ev.starts_at)) returning * into tr;
  insert into email_outbox(dedupe_key,recipient,template,payload) values('transfer:'||tr.id,tr.recipient_email,'transfer',jsonb_build_object('token',p_data->>'token','transferId',tr.id));
  return jsonb_build_object('id',tr.id,'expiresAt',tr.expires_at);
 elsif p_action='transfer:cancel' then
  update ticket_transfers set status='canceled' where ticket_id=tk.id and id=(p_data->>'transferId')::uuid and sender_id=p_user and status='pending';
  if not found then raise exception 'Pending transfer not found' using errcode='P0002'; end if;
  return jsonb_build_object('canceled',true);
 end if;
 raise exception 'Unknown action';
end $$;

create function ticketing_private.process_stripe_event(p_data jsonb) returns jsonb
language plpgsql security definer set search_path=public,extensions as $$
declare ord orders; i record; tk tickets; refund_total bigint; state text;
begin
 -- Roll back this marker too if any fulfillment operation fails.
 insert into stripe_events(id,type) values(p_data->>'eventId',p_data->>'type') on conflict do nothing;
 if not found then return jsonb_build_object('duplicate',true); end if;
 if p_data->>'type'='charge.refunded' then
  select * into ord from orders where stripe_payment_intent_id=p_data->>'paymentIntent' for update;
  if not found then raise exception 'Order not yet fulfilled; retry refund'; end if;
  refund_total:=(p_data->>'refunded')::bigint;
  if refund_total>=ord.total_amount then state:='refunded'; else state:='needs_review'; end if;
  if ord.status='refunded' then return jsonb_build_object('processed',true); end if;
  update orders set status=state where id=ord.id;
  for tk in select t.* from tickets t join order_items oi on oi.id=t.order_item_id where oi.order_id=ord.id order by t.id for update of t loop
   update tickets set status=case when state='refunded' then 'revoked' else 'suspended' end where id=tk.id and status<>'revoked';
   update ticket_credentials set revoked_at=now() where ticket_id=tk.id and revoked_at is null;
   update ticket_transfers set status='canceled' where ticket_id=tk.id and status='pending';
  end loop;
  return jsonb_build_object('processed',true);
 end if;
 select * into ord from orders where id=(p_data->>'orderId')::uuid for update;
 if not found then raise exception 'Order not found'; end if;
 if ord.stripe_session_id is not null and ord.stripe_session_id<>p_data->>'sessionId' then raise exception 'Session mismatch'; end if;
 if p_data->>'type' in ('checkout.session.expired','checkout.session.async_payment_failed') then
  update orders set status=case when p_data->>'type'='checkout.session.expired' then 'expired' else 'failed' end where id=ord.id and status='pending';
  return jsonb_build_object('processed',true);
 end if;
 if p_data->>'paymentStatus'<>'paid' then return jsonb_build_object('waiting',true); end if;
 if (p_data->>'amount')::bigint<>ord.total_amount or upper(p_data->>'currency')<>ord.currency then raise exception 'Payment total mismatch'; end if;
 if ord.status in ('paid','refunded','needs_review') then return jsonb_build_object('duplicate',true); end if;
 update orders set status='paid',paid_at=now(),stripe_session_id=p_data->>'sessionId',stripe_payment_intent_id=p_data->>'paymentIntent' where id=ord.id;
 for i in select * from order_items where order_id=ord.id loop
  insert into tickets(event_id,ticket_type_id,order_item_id,item_sequence,holder_id,issuance_source)
   select ord.event_id,i.ticket_type_id,i.id,n,ord.buyer_id,'purchase' from generate_series(1,i.quantity) n;
 end loop;
 insert into email_outbox(dedupe_key,recipient,template,payload) values('paid:'||ord.id,ord.buyer_email,'purchase',jsonb_build_object('orderId',ord.id));
 return jsonb_build_object('processed',true);
end $$;

create function ticketing_private.claim_emails() returns setof public.email_outbox
language sql security definer set search_path=public as $$
 update email_outbox set status='sending',attempts=attempts+1,available_at=now()+interval '5 minutes',lease_token=gen_random_uuid()
 where id in (select id from email_outbox where status in ('pending','sending') and available_at<=now()
 order by available_at for update skip locked limit 20) returning *;
$$;
create function ticketing_private.finish_email(p_id uuid,p_lease uuid,p_error text default null) returns void
language sql security definer set search_path=public as $$
 update email_outbox set status=case when p_error is null then 'sent' when attempts>=8 then 'failed' else 'pending' end,
 sent_at=case when p_error is null then now() else null end,last_error=left(p_error,500),
 payload=case when p_error is null then payload-'token' else payload end,
 available_at=now()+make_interval(secs=>least(3600,30*power(2,attempts)::integer))
 where id=p_id and lease_token=p_lease and status='sending';
$$;


create function public.ticket_command(p_action text, p_user uuid, p_data jsonb default '{}') returns jsonb
language sql security invoker set search_path='' as $$ select ticketing_private.ticket_command(p_action,p_user,p_data); $$;

create function public.process_stripe_event(p_data jsonb) returns jsonb
language sql security invoker set search_path='' as $$ select ticketing_private.process_stripe_event(p_data); $$;

create function public.claim_emails() returns setof public.email_outbox
language sql security invoker set search_path='' as $$ select * from ticketing_private.claim_emails(); $$;

create function public.finish_email(p_id uuid,p_lease uuid,p_error text default null) returns void
language sql security invoker set search_path='' as $$ select ticketing_private.finish_email(p_id,p_lease,p_error); $$;

revoke all on function public.ticket_command(text,uuid,jsonb) from public,anon,authenticated;
revoke all on function public.process_stripe_event(jsonb) from public,anon,authenticated;
revoke all on function public.claim_emails() from public,anon,authenticated;
revoke all on function public.finish_email(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.ticket_command(text,uuid,jsonb),public.process_stripe_event(jsonb),public.claim_emails(),public.finish_email(uuid,uuid,text) to service_role;
grant select,insert,update,delete on all tables in schema public to service_role;

revoke all on all functions in schema ticketing_private from public, anon, authenticated;
grant execute on all functions in schema ticketing_private to service_role;
create index orders_event_created on public.orders(event_id,created_at desc);
create index order_items_type on public.order_items(ticket_type_id);
create index order_items_price on public.order_items(price_id);
create index staff_user on public.event_staff(user_id);
create index tickets_event_created on public.tickets(event_id,created_at desc,id);
create index tickets_type on public.tickets(ticket_type_id);
create index tickets_issuer on public.tickets(issued_by);
create index transfer_sender on public.ticket_transfers(sender_id);
create index transfer_recipient on public.ticket_transfers(accepted_by);
create index checkins_day on public.ticket_checkins(event_day_id);
create index checkins_staff on public.ticket_checkins(staff_id);
create index profile_sectors_code on public.investor_profile_sectors(sector_code);
commit;

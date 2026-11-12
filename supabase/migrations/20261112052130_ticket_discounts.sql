begin;
create table public.discount_codes (
 id uuid primary key default gen_random_uuid(), event_id uuid not null references public.events,
 code text not null check(code ~ '^[A-Z0-9][A-Z0-9_-]{0,39}$'),
 percentage numeric(5,2) not null check(percentage>0 and percentage<=100),
 active boolean not null default true, deleted_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index live_discount_code on public.discount_codes(event_id,code) where deleted_at is null;
create table public.discount_ticket_types (
 discount_id uuid not null references public.discount_codes on delete cascade,
 ticket_type_id uuid not null references public.ticket_types,
 primary key(discount_id,ticket_type_id)
);
create index discount_ticket_type_idx on public.discount_ticket_types(ticket_type_id);
alter table public.discount_codes enable row level security;
alter table public.discount_ticket_types enable row level security;
revoke all on public.discount_codes,public.discount_ticket_types from public,anon,authenticated;
grant select,insert,update,delete on public.discount_codes,public.discount_ticket_types to service_role;

alter table public.orders add column discount_id uuid references public.discount_codes,
 add column discount_code text, add column discount_ticket_type_ids uuid[], add column discount_percentage numeric(5,2),
 add column subtotal_amount bigint, add column discount_amount bigint not null default 0 check(discount_amount>=0);
update public.orders set subtotal_amount=total_amount;
alter table public.orders alter column subtotal_amount set not null;
alter table public.orders drop constraint orders_total_amount_check;
alter table public.orders add check(total_amount>=0);
create index orders_discount_idx on public.orders(discount_id);
create index discount_usage_idx on public.orders(discount_id,paid_at desc) where paid_at is not null;

-- Existing checkout code inserts the subtotal as total before applying a code.
create function ticketing_private.order_subtotal() returns trigger language plpgsql
set search_path=public as $$ begin
 new.subtotal_amount:=coalesce(new.subtotal_amount,new.total_amount); return new;
end $$;
create trigger order_subtotal before insert on public.orders for each row execute function ticketing_private.order_subtotal();

-- Block physical deletion AND soft deletion once payment has succeeded (including refunded orders).
create function ticketing_private.protect_used_discount() returns trigger language plpgsql security definer
set search_path=public as $$ begin
 if tg_op='DELETE' or new.deleted_at is not null then
  if exists(select 1 from orders where discount_id=old.id and paid_at is not null) then
   raise exception 'Used discount codes cannot be deleted';
  end if;
 end if;
 if tg_op='DELETE' then return old; end if;
 new.updated_at:=now(); return new;
end $$;
create trigger protect_used_discount before update or delete on public.discount_codes
 for each row execute function ticketing_private.protect_used_discount();

create function ticketing_private.discount_quote(p_user uuid,p_data jsonb,p_order uuid default null)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare ev events; dc discount_codes; subtotal bigint; eligible bigint; saving bigint; begin
 if not exists(select 1 from auth.users where id=p_user and email_confirmed_at is not null) then raise exception 'Verified sign-in required' using errcode='28000'; end if;
 select * into ev from events where slug='takeoff-tokyo-2027';
 if not ev.sales_enabled or now()>=ev.starts_at then raise exception 'Sales are not open'; end if;
 select * into dc from discount_codes where event_id=ev.id and code=upper(trim(p_data->>'discountCode')) and active and deleted_at is null for update;
 if not found then raise exception 'Discount code is invalid or inactive'; end if;
 if p_order is null then
  if jsonb_typeof(p_data->'qty') is distinct from 'object' then raise exception 'Invalid ticket selection'; end if;
  if exists(select 1 from jsonb_each_text(p_data->'qty') where key not in ('startup','investor') or value !~ '^[0-9]{1,3}$') then raise exception 'Invalid ticket selection'; end if;
  if (select sum(value::integer) from jsonb_each_text(p_data->'qty')) not between 1 and 100 then raise exception 'Select 1–100 tickets'; end if;
  select sum(pp.amount*(p_data->'qty'->>tt.code)::integer),
   sum(case when dt.discount_id is not null then pp.amount*(p_data->'qty'->>tt.code)::integer else 0 end)
   into subtotal,eligible from ticket_types tt join ticket_prices pp on pp.ticket_type_id=tt.id and pp.active
   left join discount_ticket_types dt on dt.ticket_type_id=tt.id and dt.discount_id=dc.id
   where tt.event_id=ev.id and tt.public_purchase and coalesce((p_data->'qty'->>tt.code)::integer,0)>0;
 else
  select sum(i.unit_amount*i.quantity),sum(case when dt.discount_id is not null then i.unit_amount*i.quantity else 0 end)
   into subtotal,eligible from order_items i left join discount_ticket_types dt on dt.ticket_type_id=i.ticket_type_id and dt.discount_id=dc.id where i.order_id=p_order;
 end if;
 if coalesce(eligible,0)<=0 then raise exception 'This code does not apply to the selected tickets'; end if;
 saving:=round(eligible::numeric*dc.percentage/100);
 return jsonb_build_object('ticketTypeIds',(select jsonb_agg(ticket_type_id) from discount_ticket_types where discount_id=dc.id),'discountId',dc.id,'code',dc.code,'percentage',dc.percentage,'subtotal',subtotal,'discountAmount',saving,'total',subtotal-saving,'currency','JPY');
end $$;

create function ticketing_private.discount_checkout(p_user uuid,p_data jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare result jsonb; quote jsonb; ord orders; begin
 -- The underlying command serializes request-key retries and snapshots selected prices.
 result:=ticketing_private.ticket_command('order:create',p_user,p_data);
 select * into ord from orders where id=(result->>'id')::uuid for update;
 if ord.discount_id is not null or coalesce(trim(p_data->>'discountCode'),'')='' then return result; end if;
 quote:=ticketing_private.discount_quote(p_user,p_data,ord.id);
 update orders set discount_ticket_type_ids=array(select jsonb_array_elements_text(quote->'ticketTypeIds')::uuid),discount_id=(quote->>'discountId')::uuid,discount_code=quote->>'code',discount_percentage=(quote->>'percentage')::numeric,
  discount_amount=(quote->>'discountAmount')::bigint,total_amount=(quote->>'total')::bigint where id=ord.id returning * into ord;
 return to_jsonb(ord)||jsonb_build_object('items',result->'items');
end $$;

create function ticketing_private.discount_admin(p_action text,p_user uuid,p_data jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare ev uuid; dc discount_codes; associated uuid[]; begin
 select id into ev from events where slug='takeoff-tokyo-2027';
 if not exists(select 1 from event_staff s join auth.users u on u.id=s.user_id where s.event_id=ev and s.user_id=p_user and s.role='admin' and u.email_confirmed_at is not null) then raise exception 'Admin required' using errcode='42501'; end if;
 if p_action='discount:list' then
  return coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (
   select d.*,coalesce((select jsonb_agg(t.code order by t.code) from discount_ticket_types a join ticket_types t on t.id=a.ticket_type_id where a.discount_id=d.id),'[]'::jsonb) as tickets,
    (select count(*) from orders where discount_id=d.id and paid_at is not null) as usage_count
   from discount_codes d where d.event_id=ev and (d.deleted_at is null or exists(select 1 from orders where discount_id=d.id and paid_at is not null))) x),'[]'::jsonb);
 end if;
 if p_action<>'discount:create' then
  select * into dc from discount_codes where id=(p_data->>'id')::uuid and event_id=ev for update;
  if not found then raise exception 'Discount not found' using errcode='P0002'; end if;
 end if;
 if p_action='discount:uses' then
  return coalesce((select jsonb_agg(to_jsonb(x)) from (select id as order_id,buyer_email as email,buyer_name,paid_at,discount_code,discount_percentage,discount_amount,currency,status
   from orders where discount_id=dc.id and paid_at is not null order by paid_at desc,id limit 100 offset greatest(0,coalesce((p_data->>'offset')::integer,0))) x),'[]'::jsonb);
 elsif p_action='discount:delete' then
  -- Keep tombstones for outstanding Stripe sessions; they can still complete at their captured price.
  update discount_codes set deleted_at=now(),active=false where id=dc.id;
  return jsonb_build_object('deleted',true);
 elsif p_action in ('discount:create','discount:update') then
  if p_action='discount:update' and dc.deleted_at is not null then raise exception 'Discount has been deleted'; end if;
  if coalesce(p_data->>'code','') !~ '^[A-Z0-9][A-Z0-9_-]{0,39}$' then raise exception 'Invalid discount code'; end if;
  if jsonb_typeof(p_data->'tickets') is distinct from 'array' or jsonb_array_length(p_data->'tickets')=0 then raise exception 'Select specific ticket types'; end if;
  if exists(select 1 from jsonb_array_elements_text(p_data->'tickets') v where v not in ('startup','investor')) then raise exception 'Only purchasable tickets can be discounted'; end if;
  select array_agg(id) into associated from ticket_types where event_id=ev and public_purchase and code in (select jsonb_array_elements_text(p_data->'tickets'));
  if p_action='discount:create' then
   insert into discount_codes(event_id,code,percentage,active) values(ev,p_data->>'code',(p_data->>'percentage')::numeric,coalesce((p_data->>'active')::boolean,true)) returning * into dc;
  else
   update discount_codes set code=p_data->>'code',percentage=(p_data->>'percentage')::numeric,active=coalesce((p_data->>'active')::boolean,true) where id=dc.id returning * into dc;
  end if;
  delete from discount_ticket_types where discount_id=dc.id;
  insert into discount_ticket_types select dc.id,unnest(associated);
  return to_jsonb(dc);
 end if;
 raise exception 'Unknown discount operation';
end $$;

create or replace function public.ticket_command(p_action text,p_user uuid,p_data jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path='' as $$ begin
 if p_action='order:create' then return ticketing_private.discount_checkout(p_user,p_data);
 elsif p_action='discount:quote' then return ticketing_private.discount_quote(p_user,p_data);
 elsif p_action like 'discount:%' then return ticketing_private.discount_admin(p_action,p_user,p_data);
 else return ticketing_private.ticket_command(p_action,p_user,p_data); end if;
end $$;

create or replace function ticketing_private.process_stripe_event(p_data jsonb) returns jsonb
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
 if p_data->>'paymentStatus' not in ('paid','no_payment_required') then return jsonb_build_object('waiting',true); end if;
 if (p_data->>'amount')::bigint<>ord.total_amount or upper(p_data->>'currency')<>ord.currency then raise exception 'Payment total mismatch'; end if;
 if ord.status in ('paid','refunded','needs_review') then return jsonb_build_object('duplicate',true); end if;
 if ord.discount_id is not null then perform 1 from discount_codes where id=ord.discount_id for update; end if;
 update orders set status='paid',paid_at=now(),stripe_session_id=p_data->>'sessionId',stripe_payment_intent_id=p_data->>'paymentIntent' where id=ord.id;
 for i in select * from order_items where order_id=ord.id loop
  insert into tickets(event_id,ticket_type_id,order_item_id,item_sequence,holder_id,issuance_source)
   select ord.event_id,i.ticket_type_id,i.id,n,ord.buyer_id,'purchase' from generate_series(1,i.quantity) n;
 end loop;
 insert into email_outbox(dedupe_key,recipient,template,payload) values('paid:'||ord.id,ord.buyer_email,'purchase',jsonb_build_object('orderId',ord.id));
 return jsonb_build_object('processed',true);
end $$;


revoke all on all functions in schema ticketing_private from public,anon,authenticated;
grant execute on all functions in schema ticketing_private to service_role;
commit;

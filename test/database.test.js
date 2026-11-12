import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import { readFileSync, readdirSync } from 'node:fs';

const database=process.env.TEST_DATABASE_URL;
const exec=promisify(execFile);
function sql(query){return execFileSync('psql',[database,'-X','-A','-t','-v','ON_ERROR_STOP=1','-c',query],{encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();}
async function parallelSql(query){return (await exec('psql',[database,'-X','-A','-t','-v','ON_ERROR_STOP=1','-c',query])).stdout.trim();}
function literal(value){return "'"+JSON.stringify(value).replaceAll("'","''")+"'::jsonb";}
const buyer='00000000-0000-4000-8000-000000000001', recipient='00000000-0000-4000-8000-000000000002',admin='00000000-0000-4000-8000-000000000003';
function command(action,user,data={}){return `select public.ticket_command('${action}','${user}',${literal(data)})`;}
function call(action,user,data){return JSON.parse(sql(command(action,user,data)));}

test('PostgreSQL: fulfillment, transfer, check-in, refunds, RLS and outbox transactions', {skip:!database},async()=>{
 // Use only a disposable, EMPTY database: this bootstrap mimics Supabase auth.
 sql(`create schema auth; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
 do $$ begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if;
 if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
 if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role; end if; end $$;`);
 for (const migration of readdirSync(new URL('../supabase/migrations/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort()) sql(readFileSync(new URL('../supabase/migrations/'+migration,import.meta.url),'utf8'));
 sql(`insert into auth.users values ('${buyer}','buyer@example.com',now()),('${recipient}','recipient@example.com',now()),('${admin}','admin@example.com',now());
 update events set sales_enabled=true,starts_at=now()+interval '1 day',ends_at=now()+interval '3 days';
 insert into event_staff select id,'${admin}','admin' from events;
 insert into ticket_prices(ticket_type_id,amount,currency,stripe_price_id,active) select id,case code when 'startup' then 3000 else 6000 end,'JPY','price_'||code,true from ticket_types where public_purchase;
 update event_days set day=case day when '2027-03-17'::date then (now() at time zone 'Asia/Tokyo')::date else (now() at time zone 'Asia/Tokyo')::date+1 end;`);
 const catalog=JSON.parse(sql(`select ticket_command('catalog',null)`));
 assert.deepEqual(catalog.types.map(t=>t.code).sort(),['investor','startup']);
 assert.throws(()=>sql(`set role authenticated; select * from tickets`));
 assert.throws(()=>sql(`set role authenticated; select ticket_command('catalog',null)`));
 assert.throws(()=>call('order:create',buyer,{name:'Buyer',requestKey:crypto.randomUUID(),qty:{crew:1}}));
 const input={name:'Buyer',requestKey:crypto.randomUUID(),qty:{startup:2,investor:1}};
 const [one,two]=await Promise.all([parallelSql(command('order:create',buyer,input)),parallelSql(command('order:create',buyer,input))]);
 const order=JSON.parse(one);assert.equal(order.id,JSON.parse(two).id);assert.equal(order.total_amount,12000);
 assert.throws(()=>call('order:create',buyer,{...input,qty:{startup:1}}));
 call('order:link',buyer,{id:order.id,sessionId:'cs_test',url:'https://checkout.stripe.com/test'});
 const paid={type:'checkout.session.completed',orderId:order.id,sessionId:'cs_test',paymentStatus:'paid',amount:12000,currency:'jpy',paymentIntent:'pi_test'};
 await Promise.all(['evt_1','evt_2'].map(eventId=>parallelSql(`select process_stripe_event(${literal({...paid,eventId})})`)));
 assert.equal(sql('select count(*) from tickets'),'3');assert.equal(sql("select count(*) from email_outbox where template='purchase'"),'1');
 const tickets=call('tickets:list',buyer); const ticket=tickets.find(t=>t.type==='startup');const scanTicket=tickets.find(t=>t.type==='investor');
 assert.throws(()=>call('qr',buyer,{id:ticket.id}));
 call('attendee:save',buyer,{id:ticket.id,name:'Original',profile:{business_description:'Old private answers',funding_amount:12345,funding_currency:'USD',funding_stage:'seed'}});
 const old=call('qr',buyer,{id:ticket.id});
 const transfer=call('transfer:create',buyer,{id:ticket.id,email:'recipient@example.com',token:'accept-token',tokenHash:'accept-hash'});
 assert.throws(()=>call('transfer:accept',buyer,{tokenHash:'accept-hash'}));
 const accepted=await Promise.allSettled([parallelSql(command('transfer:accept',recipient,{tokenHash:'accept-hash'})),parallelSql(command('transfer:accept',recipient,{tokenHash:'accept-hash'}))]);
 assert.equal(accepted.filter(x=>x.status==='fulfilled').length,1);
 assert.equal(call('tickets:list',recipient)[0].attendee,null);assert.equal(sql(`select count(*) from startup_profiles where ticket_id='${ticket.id}'`),'0');
 assert.throws(()=>call('qr',buyer,{id:ticket.id}));assert.throws(()=>call('transfer:cancel',buyer,{transferId:transfer.id}));
 assert.throws(()=>sql(command('checkin',admin,{tokenHash:sql(`select encode(digest('${old.credentialId}','sha256'),'hex')`)})));
 call('attendee:save',recipient,{id:ticket.id,name:'New holder',profile:{}});
 assert.notEqual(call('qr',recipient,{id:ticket.id}).credentialId,old.credentialId);
 call('attendee:save',buyer,{id:scanTicket.id,name:'Investor',profile:{investment_min:100,investment_max:200,investment_currency:'EUR',leads_deals:false,seeking_lps:null,sectors:['fintech','climate']}});
 assert.throws(()=>call('attendee:save',buyer,{id:scanTicket.id,name:'Bad',profile:{investment_min:200,investment_max:100,investment_currency:'EUR'}}));
 assert.equal(sql(`select full_name from ticket_attendees where ticket_id='${scanTicket.id}'`),'Investor');
 const scanCredential=call('qr',buyer,{id:scanTicket.id});
 const hash=sql(`select encode(digest('${scanCredential.credentialId}','sha256'),'hex')`);
 assert.throws(()=>call('checkin',recipient,{tokenHash:hash}));
 const scans=await Promise.all([parallelSql(command('checkin',admin,{tokenHash:hash})),parallelSql(command('checkin',admin,{tokenHash:hash}))]);
 assert.equal(scans.map(JSON.parse).filter(x=>x.admitted).length,1);
 assert.throws(()=>call('transfer:create',buyer,{id:scanTicket.id,email:'recipient@example.com',token:'blocked',tokenHash:'blocked-hash'}));
 sql(`update event_days set day=day-1`);
 assert.equal(call('checkin',admin,{tokenHash:hash}).admitted,true);
 assert.equal(sql(`select count(*) from ticket_checkins where ticket_id='${scanTicket.id}'`),'2');
 // A race between transfer acceptance and first use has only one winner.
 const raceTicket=tickets.find(t=>t.id!==ticket.id&&t.id!==scanTicket.id);
 call('attendee:save',buyer,{id:raceTicket.id,name:'Race',profile:{}});
 const raceCredential=call('qr',buyer,{id:raceTicket.id});
 call('transfer:create',buyer,{id:raceTicket.id,email:'recipient@example.com',token:'race-token',tokenHash:'race-hash'});
 const raceHash=sql(`select encode(digest('${raceCredential.credentialId}','sha256'),'hex')`);
 const raced=await Promise.allSettled([parallelSql(command('checkin',admin,{tokenHash:raceHash})),parallelSql(command('transfer:accept',recipient,{tokenHash:'race-hash'}))]);
 assert.equal(raced.filter(x=>x.status==='fulfilled').length,1);
 sql(`select process_stripe_event(${literal({eventId:'evt_partial',type:'charge.refunded',paymentIntent:'pi_test',refunded:1000})})`);
 assert.equal(sql(`select status from orders where id='${order.id}'`),'needs_review');
 assert.equal(sql("select count(*) from tickets where status='suspended'"),'3');
 sql(`select process_stripe_event(${literal({eventId:'evt_refund',type:'charge.refunded',paymentIntent:'pi_test',refunded:12000})})`);
 assert.equal(sql("select count(*) from tickets where status='revoked'"),'3');
 assert.throws(()=>call('checkin',admin,{tokenHash:hash}));
 assert.throws(()=>call('crew:create',buyer,{name:'Crew',email:'recipient@example.com'}));
 const crew=call('crew:create',admin,{name:'Crew',email:'recipient@example.com'});assert.equal(crew.order_item_id,null);

 // Discount CRUD, eligibility, immutable snapshots and payment-only email attribution.
 assert.throws(()=>call('discount:create',buyer,{code:'NOPE',percentage:20,tickets:['startup']}));
 const discount=call('discount:create',admin,{code:'STARTUP20',percentage:20,tickets:['startup'],active:true});
 const quote=call('discount:quote',buyer,{discountCode:'startup20',qty:{startup:2,investor:1}});
 assert.equal(quote.discountAmount,1200);assert.equal(quote.total,10800);
 assert.throws(()=>call('discount:quote',buyer,{discountCode:'STARTUP20',qty:{investor:1}}));
 assert.throws(()=>call('discount:create',admin,{code:'CREW',percentage:20,tickets:['crew']}));
 const discountedInput={name:'Buyer',requestKey:crypto.randomUUID(),qty:{startup:2,investor:1},discountCode:'STARTUP20'};
 const discounted=call('order:create',buyer,discountedInput);
 assert.equal(discounted.total_amount,10800);assert.equal(discounted.subtotal_amount,12000);
 assert.equal(call('discount:uses',admin,{id:discount.id}).length,0);
 call('discount:update',admin,{id:discount.id,code:'STARTUP30',percentage:30,tickets:['startup'],active:true});
 assert.equal(call('order:create',buyer,discountedInput).total_amount,10800);
 const discountPaid={eventId:'evt_discount',type:'checkout.session.completed',orderId:discounted.id,sessionId:'cs_discount',paymentStatus:'paid',amount:10800,currency:'jpy',paymentIntent:'pi_discount'};
 sql(`select process_stripe_event(${literal(discountPaid)})`);
 const usage=call('discount:uses',admin,{id:discount.id});
 assert.equal(usage.length,1);assert.equal(usage[0].email,'buyer@example.com');assert.equal(usage[0].discount_code,'STARTUP20');assert.equal(usage[0].discount_percentage,20);
 assert.throws(()=>call('discount:delete',admin,{id:discount.id}));
 assert.throws(()=>sql(`delete from discount_codes where id='${discount.id}'`));
 assert.throws(()=>call('discount:uses',recipient,{id:discount.id}));
 sql(`select process_stripe_event(${literal({...discountPaid,eventId:'evt_discount_again'})})`);
 assert.equal(call('discount:uses',admin,{id:discount.id}).length,1);
 sql(`select process_stripe_event(${literal({eventId:'evt_discount_refund',type:'charge.refunded',paymentIntent:'pi_discount',refunded:10800})})`);
 assert.throws(()=>call('discount:delete',admin,{id:discount.id}));
 assert.equal(call('discount:uses',admin,{id:discount.id})[0].status,'refunded');
 const unused=call('discount:create',admin,{code:'UNUSED',percentage:10,tickets:['startup','investor']});
 call('discount:delete',admin,{id:unused.id});
 assert.throws(()=>call('discount:quote',buyer,{discountCode:'UNUSED',qty:{startup:1}}));
 assert.equal(call('discount:list',admin).some(d=>d.id===unused.id),false);
 assert.notEqual(call('discount:create',admin,{code:'UNUSED',percentage:15,tickets:['investor']}).id,unused.id);
 const free=call('discount:create',admin,{code:'FREE',percentage:100,tickets:['startup']});
 const freeOrder=call('order:create',buyer,{name:'Buyer',requestKey:crypto.randomUUID(),qty:{startup:1},discountCode:'FREE'});
 assert.equal(freeOrder.total_amount,0);
 sql(`select process_stripe_event(${literal({eventId:'evt_free',type:'checkout.session.completed',orderId:freeOrder.id,sessionId:'cs_free',paymentStatus:'no_payment_required',amount:0,currency:'jpy',paymentIntent:null})})`);
 assert.equal(call('discount:uses',admin,{id:free.id}).length,1);
 assert.throws(()=>call('discount:delete',admin,{id:free.id}));
 const jobs=JSON.parse(sql('select coalesce(jsonb_agg(to_jsonb(x)),\'[]\') from claim_emails() x'));assert.ok(jobs.length>0);
 assert.equal(sql('select count(*) from claim_emails()'),'0');
 const job=jobs[0];sql(`select finish_email('${job.id}','${crypto.randomUUID()}',null)`);
 assert.equal(sql(`select status from email_outbox where id='${job.id}'`),'sending');
 sql(`select finish_email('${job.id}','${job.lease_token}',null)`);
 assert.equal(sql(`select status from email_outbox where id='${job.id}'`),'sent');
});

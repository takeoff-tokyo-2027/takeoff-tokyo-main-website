import test from 'node:test';
import assert from 'node:assert/strict';
import { checkoutInput, attendeeInput, signCredential, verifyCredential, sha256, email, discountCode, discountInput } from '../functions/lib/core.js';
import { emailContent } from '../workers/email-outbox.js';
import { onRequest } from '../functions/api/[[path]].js';

test('checkout rejects private tickets, manipulated quantities and missing names', () => {
 const base={name:'Buyer',qty:{startup:2,investor:3},requestKey:crypto.randomUUID()};
 assert.deepEqual(checkoutInput(base),base);
 assert.deepEqual(checkoutInput({...base,qty:{general_admission:2}}).qty,{general_admission:2});
 for(const qty of [{crew:1},{'bad-code':1},{startup:1.5},{startup:-1},{startup:101},{startup:0},{startup:50,investor:51},{startup:'1'},[]]) assert.throws(()=>checkoutInput({...base,qty}));
 assert.throws(()=>checkoutInput({...base,name:' '}));
 assert.throws(()=>checkoutInput({...base,requestKey:'client-controlled-nonuuid'}));
});
test('questionnaires preserve unanswered vs false and reject float money',()=>{
 assert.deepEqual(attendeeInput({name:' Person ',profile:{leads_deals:false,seeking_lps:null,investment_min:100}}).profile,{leads_deals:false,seeking_lps:null,investment_min:100});
 for(const profile of [{funding_amount:1.5},{funding_amount:-1},{funding_currency:'XXX'},{leads_deals:'false'},{sectors:'AI'}]) assert.throws(()=>attendeeInput({name:'Person',profile}));
 assert.throws(()=>email('bad@example.com\nBcc:other@example.com'));
});
test('QR credentials are authenticated, opaque, and tamper resistant',async()=>{
 const env={QR_SIGNING_SECRET:'test-secret-'.repeat(4)};
 const id=crypto.randomUUID(); const token=await signCredential(env,id);
 assert.equal(await verifyCredential(env,token),await sha256(id));
 await assert.rejects(()=>verifyCredential(env,token.slice(0,-1)+(token.endsWith('0')?'1':'0')));
 await assert.rejects(()=>verifyCredential({...env,QR_SIGNING_SECRET:'different-secret'.repeat(4)},token));
 assert.equal(token.includes('@'),false);
});
test('transfer email sends only a recipient acceptance link, not order management access',()=>{
 const message=emailContent({template:'transfer',payload:{token:'secret-token'}},'https://takeoff.example');
 assert.match(message.textContent,/#transfer=secret-token/);
 assert.doesNotMatch(message.textContent,/service_role|order=/);
});
test('API protects account/ticket operations and rejects cross-origin checkout',async()=>{
 const anonymous=await onRequest({request:new Request('https://site.example/api/checkins',{method:'POST',body:'{}'}),env:{SITE_URL:'https://site.example'}});
 assert.equal(anonymous.status,401);
 const foreign=await onRequest({request:new Request('https://site.example/api/create-checkout',{method:'POST',headers:{Origin:'https://evil.example'},body:'{}'}),env:{SITE_URL:'https://site.example'}});
 assert.equal(foreign.status,403);
 for(const [path,method] of [['/me','GET'],['/me/tickets','GET'],[`/orders/${crypto.randomUUID()}`,'GET'],[`/tickets/${crypto.randomUUID()}/qr`,'GET'],[`/tickets/${crypto.randomUUID()}/attendee`,'PATCH'],['/admin/tickets','GET']]){
  assert.equal((await onRequest({request:new Request(`https://site.example/api${path}`,{method}),env:{SITE_URL:'https://site.example'}})).status,401);
 }
});

test('guest checkout validates email and creates a payment session without authenticating',async(t)=>{
 const originalFetch=globalThis.fetch;t.after(()=>{globalThis.fetch=originalFetch;});
 const calls=[];const orderId=crypto.randomUUID();const requestKey=crypto.randomUUID();
 globalThis.fetch=async(url,options)=>{
  calls.push({url:String(url),data:options?.body});
  if(String(url)==='https://example.supabase.co/rest/v1/rpc/ticket_command'){
   const command=JSON.parse(options.body);assert.equal(command.p_user,null);
   if(command.p_action==='order:create'){
    assert.equal(command.p_data.email,'guest@example.com');assert.equal(command.p_data.requestKey,requestKey);
    return Response.json({id:orderId,status:'pending',created_at:new Date().toISOString(),buyer_email:command.p_data.email,discount_amount:0,items:[{stripe_price_id:'price_startup',quantity:1}]});
   }
   assert.equal(command.p_action,'order:link');assert.equal(command.p_data.requestKey,requestKey);assert.equal(command.p_data.sessionId,'cs_guest');
   return Response.json({id:orderId});
  }
  if(String(url)==='https://api.stripe.com/v1/checkout/sessions'){
   const data=new URLSearchParams(options.body);
   assert.equal(data.get('customer_email'),'guest@example.com');
   assert.equal(data.get('success_url'),`https://site.example/account/tickets?order=${orderId}`);
   assert.equal(data.get('cancel_url'),'https://site.example/?checkout=canceled');
   return Response.json({id:'cs_guest',url:'https://checkout.stripe.com/guest'});
  }
  throw new Error(`Unexpected network call: ${url}`);
 };
 const env={SITE_URL:'https://site.example',SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'test-service-key',STRIPE_SECRET_KEY:'sk_test_notreal'};
 const input={name:'Guest',email:' Guest@Example.com ',qty:{startup:1},requestKey};
 const request=data=>new Request('https://site.example/api/create-checkout',{method:'POST',headers:{Origin:'https://site.example','Content-Type':'application/json'},body:JSON.stringify(data)});
 for(const email of [undefined,'invalid']) assert.equal((await onRequest({request:request({...input,email}),env})).status,400);
 assert.equal(calls.length,0);
 const result=await onRequest({request:request(input),env});
 assert.equal(result.status,200);assert.deepEqual(await result.json(),{orderId,url:'https://checkout.stripe.com/guest'});
 assert.equal(calls.length,3);
});

test('guest discount preview does not authenticate',async(t)=>{
 const originalFetch=globalThis.fetch;t.after(()=>{globalThis.fetch=originalFetch;});
 globalThis.fetch=async(url,options)=>{
  assert.equal(String(url),'https://example.supabase.co/rest/v1/rpc/ticket_command');
  const command=JSON.parse(options.body);assert.equal(command.p_user,null);assert.equal(command.p_action,'discount:quote');
  return Response.json({code:'LAUNCH20',total:2400});
 };
 const result=await onRequest({request:new Request('https://site.example/api/discounts/quote',{method:'POST',body:JSON.stringify({qty:{startup:1},discountCode:'launch20'})}),env:{SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'test-service-key'}});
 assert.equal(result.status,200);assert.equal((await result.json()).total,2400);
});
test('forged Stripe webhook signatures are rejected without fulfillment',async()=>{
 const response=await onRequest({request:new Request('https://site.example/api/stripe-webhook',{method:'POST',headers:{'stripe-signature':'t=1,v1=forged'},body:JSON.stringify({type:'checkout.session.completed'})}),env:{STRIPE_SECRET_KEY:'sk_test_notreal',STRIPE_WEBHOOK_SECRET:'whsec_test'}});
 assert.equal(response.status,400);
});

test('discount inputs normalize codes and enforce specific tickets and percentage bounds',()=>{
 assert.equal(discountCode(' launch20 '),'LAUNCH20');
 assert.equal(discountInput({code:'x',percentage:12.5,tickets:['startup']}).percentage,12.5);
 for(const percentage of [0,-1,100.01,1.234,null,'bad']) assert.throws(()=>discountInput({code:'X',percentage,tickets:['startup']}));
 for(const tickets of [[],['crew'],['bad-code'],'startup']) assert.throws(()=>discountInput({code:'X',percentage:10,tickets}));
 assert.equal(checkoutInput({name:'Buyer',qty:{startup:1},requestKey:crypto.randomUUID(),discountCode:'launch20'}).discountCode,'LAUNCH20');
});
test('environment boundaries reject production schema/key access in local and staging',async()=>{
 const {databaseSchema,stripeSecret,matchesPayment}=await import('../functions/lib/environment.js');
 assert.equal(databaseSchema({APP_ENV:'staging',SUPABASE_DB_SCHEMA:'staging'}),'staging');
 assert.throws(()=>databaseSchema({APP_ENV:'staging'}));
 assert.throws(()=>databaseSchema({APP_ENV:'local',SUPABASE_URL:'https://prod.supabase.co'}));
 assert.throws(()=>stripeSecret({APP_ENV:'staging',STRIPE_SECRET_KEY:'sk_live_notreal'}));
 assert.throws(()=>stripeSecret({APP_ENV:'production',STRIPE_SECRET_KEY:'sk_test_notreal'}));
 assert.equal(stripeSecret({APP_ENV:'local',STRIPE_SECRET_KEY:'sk_test_notreal'}),'sk_test_notreal');
 const s={metadata:{event_slug:'takeoff-tokyo-2027',environment:'staging'}};
 assert.equal(matchesPayment({APP_ENV:'production'},s,false),false);
 assert.equal(matchesPayment({APP_ENV:'staging'},s,true),false);
 assert.equal(matchesPayment({APP_ENV:'staging'},s,false),true);
});

test('Cloudflare branches and preview origins stay isolated',async()=>{
 const {branchEnvironment}=await import('../scripts/cloudflare-build.mjs');
 const {allowedOrigin}=await import('../functions/lib/environment.js');
 assert.equal(branchEnvironment('main'),'production');assert.equal(branchEnvironment('dev'),'staging');assert.throws(()=>branchEnvironment('feature'));
 const env={APP_ENV:'staging',SITE_URL:'https://dev.takeoff-tokyo-main-website.pages.dev'};
 assert.equal(allowedOrigin(env,new Request('https://aabbccdd.takeoff-tokyo-main-website.pages.dev/api/create-checkout',{headers:{Origin:'https://aabbccdd.takeoff-tokyo-main-website.pages.dev'}})),true);
 assert.equal(allowedOrigin(env,new Request('https://evil.example/api/create-checkout',{headers:{Origin:'https://evil.example'}})),false);
});

test('local and staging reuse only sandbox keys from the workspace baseline',async()=>{
 const {sandboxKey}=await import('../scripts/sandbox-key.mjs');
 assert.equal(sandboxKey({STRIPE_SECRET_KEY:'sk_test_example'}),'sk_test_example');
 assert.equal(sandboxKey({STRIPE_SECRET_KEY:'sk_test_example'},'rk_test_local'),'rk_test_local');
 assert.throws(()=>sandboxKey({STRIPE_SECRET_KEY:'sk_live_example'}));
 assert.throws(()=>sandboxKey({STRIPE_SECRET_KEY:'sk_test_example'},'rk_live_example'));
});

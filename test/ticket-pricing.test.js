import test from 'node:test';
import assert from 'node:assert/strict';
import {applyTicketPrice,newTicketInput,editTicketInput,priceInput} from '../functions/lib/ticket-pricing.js';
const id=crypto.randomUUID(),key=crypto.randomUUID();
test('catalog input validates immutable code, public availability and whole-yen prices',()=>{
 assert.equal(newTicketInput({code:'GENERAL',label:' General ',requestKey:key}).code,'general');
 for(const code of ['crew','bad-code','1test',''])assert.throws(()=>newTicketInput({code,label:'Test',requestKey:key}));
 assert.throws(()=>editTicketInput({label:'General',publicPurchase:'true'}));
 for(const amount of [0,-1,10.5,'500',100000000])assert.throws(()=>priceInput({amount,requestKey:key}));
 assert.equal(priceInput({amount:500,requestKey:key}).amount,500);
});
test('price changes authorize before Stripe and applied retries create nothing',async()=>{
 const stripe=new Proxy({},{get(){throw Error('Stripe must not be called');}});
 await assert.rejects(()=>applyTicketPrice(stripe,async()=>{throw Error('Admin required');},id,{amount:500,requestKey:key},'local'),/Admin required/);
 assert.deepEqual(await applyTicketPrice(stripe,async()=>({status:'applied'}),id,{},'local'),{applied:true});
 await assert.rejects(()=>applyTicketPrice(stripe,async()=>({status:'superseded'}),id,{},'local'),{status:409});
});
test('new price uses an environment-specific product and a stable idempotency key',async()=>{
 const calls=[];const operation=crypto.randomUUID();
 const stripe={products:{retrieve:async()=>{throw {statusCode:404};},create:async(data,options)=>{calls.push({data,options});return {id:data.id,active:true};}},prices:{create:async(data,options)=>{calls.push({data,options});return {id:'price_test'};}}};
 const command=async(action,data)=>{if(action==='price:prepare')return {id:operation,amount:500,label:'General',status:'pending'};assert.equal(action,'price:commit');assert.equal(data.stripePriceId,'price_test');return {applied:true};};
 await applyTicketPrice(stripe,command,id,{amount:500,requestKey:key},'staging');
 assert.equal(calls[0].data.id,`tt_staging_${id}`);assert.equal(calls[1].data.currency,'jpy');assert.equal(calls[1].data.unit_amount,500);assert.equal(calls[1].options.idempotencyKey,`ticket-price:${operation}`);
 stripe.products.retrieve=async()=>({id:`tt_staging_${id}`,active:true});
 await assert.rejects(()=>applyTicketPrice(stripe,async(action)=>action==='price:prepare'?{id:operation,amount:500,status:'pending'}:{conflict:true},id,{},'staging'),{status:409});
});

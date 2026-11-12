import {HttpError,uuid,text} from './core.js';
export function newTicketInput(data){
 const code=text(data.code,40,true).toLowerCase();
 if(!/^[a-z][a-z0-9_]{0,39}$/.test(code)||code==='crew')throw new HttpError(400,'Use a public ticket code starting with a letter, followed by letters, numbers or underscores');
 return {code,label:text(data.label,120,true),requestKey:uuid(data.requestKey)};
}
export function editTicketInput(data){
 if(typeof data.publicPurchase!=='boolean')throw new HttpError(400,'Specify whether this ticket is available for purchase');
 return {label:text(data.label,120,true),publicPurchase:data.publicPurchase};
}
export function priceInput(data){
 if(!Number.isSafeInteger(data.amount)||data.amount<1||data.amount>99999999)throw new HttpError(400,'Price must be a whole-yen amount between 1 and 99999999');
 return {amount:data.amount,requestKey:uuid(data.requestKey)};
}
export async function applyTicketPrice(stripe,command,id,input,envName){
 // Authorization and request-key validation happen before any Stripe mutation.
 const op=await command('price:prepare',{...input,id});
 if(op.status==='applied')return {applied:true};
 if(op.status==='superseded')throw new HttpError(409,'Another admin changed the price. Reload and start a new price change.');
 const productId=`tt_${envName}_${id}`;
 let product;
 try{product=await stripe.products.retrieve(productId);}catch(error){
  if(error.statusCode!==404)throw error;
  try{product=await stripe.products.create({id:productId,name:op.label,metadata:{ticket_type_id:id,environment:envName}},{idempotencyKey:`ticket-product:${envName}:${id}`});}
  catch(failure){if(failure.code!=='resource_already_exists')throw failure;product=await stripe.products.retrieve(productId);}
 }
 if(!product.active)await stripe.products.update(product.id,{active:true});
 const price=await stripe.prices.create({currency:'jpy',unit_amount:op.amount,product:product.id,metadata:{ticket_type_id:id,environment:envName,operation_id:op.id}},{idempotencyKey:`ticket-price:${op.id}`});
 const result=await command('price:commit',{id,operationId:op.id,stripePriceId:price.id});
 if(result.conflict)throw new HttpError(409,'Another admin changed the price. Reload and start a new price change.');
 return result;
}

import {execFile,spawn} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {parseEnv} from 'node:util';
import {promisify} from 'node:util';
import {createInterface} from 'node:readline';
import {databaseSchema,loopback,stripeSecret} from '../functions/lib/environment.js';
const root=resolve(import.meta.dirname,'..');
const file=resolve(root,'.env.local-testing.local');
const redact=value=>String(value).replace(/whsec_[A-Za-z0-9_]+|[sr]k_(?:test|live)_[A-Za-z0-9_]+/g,'[redacted]');
try{
 const flags=process.argv.slice(2);
 if(flags.some(flag=>!['--configure-only','--listen-only'].includes(flag))||new Set(flags).size!==flags.length||flags.length>1)throw Error('Usage: npm run local:stripe -- [--configure-only|--listen-only]');
 const configureOnly=flags.includes('--configure-only');
 const listenOnly=flags.includes('--listen-only');
 const source=readFileSync(file,'utf8');const env=parseEnv(source);
 if(env.APP_ENV!=='local'||!loopback(env.SITE_URL))throw Error('Local environment required');
 databaseSchema(env);
 const childEnv={...process.env,STRIPE_API_KEY:stripeSecret(env)};
 const identity=['--device-name','ticketing-local'];
 if(!listenOnly){
  const {stdout}=await promisify(execFile)('stripe',['listen','--print-secret',...identity],{env:childEnv,timeout:30000});
  const secret=stdout.match(/\bwhsec_[A-Za-z0-9_]+\b/)?.[0];
  if(!secret)throw Error('Stripe did not return a local webhook signing secret');
  const lines=source.split(/\r?\n/).filter(line=>!/^\s*(?:export\s+)?STRIPE_WEBHOOK_SECRET\s*=/.test(line));
  writeFileSync(file,lines.join('\n').trimEnd()+`\nSTRIPE_WEBHOOK_SECRET=${JSON.stringify(secret)}\n`,{mode:0o600});
  console.log('Local webhook configured. Start or restart npm run dev to load the signing secret.');
 }else if(!/^whsec_[A-Za-z0-9_]+$/.test(env.STRIPE_WEBHOOK_SECRET||''))throw Error('Configure the local webhook first with npm run local:stripe -- --configure-only');
 if(!configureOnly){
 const target=new URL('/api/stripe-webhook',env.SITE_URL).href;
 const child=spawn('stripe',['listen',...identity,'--events','checkout.session.completed,checkout.session.async_payment_succeeded,checkout.session.async_payment_failed,checkout.session.expired,charge.refunded','--forward-to',target],{env:childEnv,stdio:['ignore','pipe','pipe']});
 for(const [input,output] of [[child.stdout,process.stdout],[child.stderr,process.stderr]]){
  createInterface({input}).on('line',line=>output.write(redact(line)+'\n'));
 }
 child.on('error',()=>{console.error('Unable to start Stripe CLI. Install it and run npm run local:stripe again.');process.exitCode=1;});
 child.on('exit',code=>{if(code)process.exitCode=code;});
 for(const signal of ['SIGINT','SIGTERM','SIGHUP'])process.on(signal,()=>child.kill(signal));
 }
}catch(error){console.error('Local Stripe forwarding failed:',redact(error.message));process.exitCode=1;}

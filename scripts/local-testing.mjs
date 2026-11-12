import {execFileSync,spawn} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {randomBytes} from 'node:crypto';
import {parseEnv} from 'node:util';
import {sandboxKey} from './sandbox-key.mjs';
import {loopback,databaseSchema,stripeSecret} from '../functions/lib/environment.js';
const root=resolve(import.meta.dirname,'..');
const schema=resolve(process.env.SCHEMA_REPO_DIR||resolve(root,'../takeoff-tokyo-supabase'));
const bin=name=>resolve(root,'node_modules/.bin',name);
const file=resolve(root,'.env.local-testing.local');
const configKeys=['SITE_URL','SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','STRIPE_SECRET_KEY','STRIPE_WEBHOOK_SECRET','QR_SIGNING_SECRET','BREVO_API_KEY','BREVO_SENDER_EMAIL','SUPABASE_DB_SCHEMA','APP_ENV','LOCAL_EMAIL_URL','STAGING_EMAIL_ALLOWLIST'];
function clean(){const env={...process.env};for(const k of Object.keys(env))if(k.startsWith('VITE_')||configKeys.includes(k))delete env[k];return env;}
function run(name,args,options={}){return execFileSync(bin(name),args,{cwd:root,env:clean(),stdio:'inherit',...options});}
const action=process.argv[2]||'serve';
try {
 if(action==='start'||action==='stop'){
  if(action==='start'){
   try{execFileSync('docker',['network','inspect','takeoff-tokyo-local-testing'],{stdio:'ignore'});}catch{execFileSync('docker',['network','create','-o','com.docker.network.bridge.host_binding_ipv4=127.0.0.1','takeoff-tokyo-local-testing'],{stdio:'inherit'});}
   run('supabase',['start','--workdir',schema,'--network-id','takeoff-tokyo-local-testing']);
   run('supabase',['migration','up','--workdir',schema]);
  }else run('supabase',['stop','--workdir',schema]);
 }else if(action==='prepare'){
  if(!existsSync(resolve(schema,'supabase/config.toml')))throw new Error('Check out the schema repository with its local config first, or set SCHEMA_REPO_DIR');
  const output=run('supabase',['status','--workdir',schema,'-o','json'],{stdio:['ignore','pipe','pipe'],encoding:'utf8'});
  const status=JSON.parse(output);
  const url=status.API_URL||status.api_url;
  if(!loopback(url))throw new Error('Refusing to generate local credentials from a hosted URL');
  const previous=existsSync(file)?parseEnv(readFileSync(file,'utf8')):{};
  const baseline=existsSync(resolve(root,'.env'))?parseEnv(readFileSync(resolve(root,'.env'),'utf8')):{};
  const values={APP_ENV:'local',SUPABASE_DB_SCHEMA:'public',SITE_URL:'http://127.0.0.1:8788',VITE_APP_ENV:'local',VITE_SUPABASE_URL:url,VITE_SUPABASE_ANON_KEY:status.ANON_KEY||status.PUBLISHABLE_KEY,SUPABASE_URL:url,SUPABASE_SERVICE_ROLE_KEY:status.SERVICE_ROLE_KEY,QR_SIGNING_SECRET:previous.QR_SIGNING_SECRET||randomBytes(32).toString('hex'),STRIPE_SECRET_KEY:sandboxKey(baseline,previous.STRIPE_SECRET_KEY),STRIPE_WEBHOOK_SECRET:previous.STRIPE_WEBHOOK_SECRET||'',LOCAL_EMAIL_URL:'http://127.0.0.1:54324'};
  if(!values.VITE_SUPABASE_ANON_KEY||!values.SUPABASE_SERVICE_ROLE_KEY)throw new Error('Local status did not provide the required keys');
  writeFileSync(file,Object.entries(values).map(([k,v])=>`${k}=${JSON.stringify(v)}`).join('\n')+'\n',{mode:0o600});
  console.log('Local credentials written to ignored .env.local-testing.local. Workspace .env was read only for its sandbox Stripe key and was not changed.');
 }else{
  if(!existsSync(file))throw new Error('Run npm run local:prepare after starting local Supabase');
  const values=parseEnv(readFileSync(file,'utf8'));
  if(values.APP_ENV!=='local'||!loopback(values.VITE_SUPABASE_URL)||values.VITE_SUPABASE_URL!==values.SUPABASE_URL||!loopback(values.SITE_URL)||!loopback(values.LOCAL_EMAIL_URL))throw new Error('Local configuration must only use loopback service URLs');
  databaseSchema(values);if(values.STRIPE_SECRET_KEY)stripeSecret(values);
  if(action==='email'){
   const {drainOutbox}=await import('../workers/email-outbox.js');
   let active=false;const tick=async()=>{if(active)return;active=true;try{await drainOutbox(values);}catch{console.error('Local email delivery unavailable; retrying.');}finally{active=false;}};
   await tick();setInterval(tick,5000);
  }else if(action==='serve'||action==='web'){
   // Keep the local API schema in step with the frontend on every startup.
   run('supabase',['migration','up','--workdir',schema]);
   const folder=resolve(root,'.local-testing');mkdirSync(folder,{recursive:true});
   run('vite',['build','--mode','local-testing','--outDir','.local-testing/dist'],{env:{...clean(),...values}});
   writeFileSync(resolve(folder,'.dev.vars'),Object.entries(values).filter(([k])=>!k.startsWith('VITE_')).map(([k,v])=>`${k}=${JSON.stringify(v)}`).join('\n'),{mode:0o600});
   writeFileSync(resolve(folder,'wrangler.toml'),'name = "takeoff-tokyo-local-testing"\nmain = "../workers/site.js"\ncompatibility_date = "2026-11-01"\ncompatibility_flags = ["nodejs_compat"]\n\n[assets]\ndirectory = "./dist"\nbinding = "ASSETS"\nnot_found_handling = "single-page-application"\nrun_worker_first = ["/api", "/api/*"]\n');
   console.log('Local website: http://127.0.0.1:8788 · Inbox: http://127.0.0.1:54324');
   const children=[spawn(bin('wrangler'),['dev','--local','--ip','127.0.0.1','--port','8788','--log-level','warn'],{cwd:folder,env:{...clean(),CLOUDFLARE_INCLUDE_PROCESS_ENV:'false',CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV:'false'},stdio:'inherit'})];
   if(action==='serve')children.push(spawn(process.execPath,[resolve(root,'scripts/local-testing.mjs'),'email'],{cwd:root,env:clean(),stdio:'inherit'}));
   const stop=()=>{for(const c of children)c.kill('SIGTERM');};for(const signal of ['SIGINT','SIGTERM','SIGHUP'])process.on(signal,stop);children[0].on('exit',stop);
  }else throw new Error('Unknown local action');
 }
}catch(e){console.error(e.message);process.exitCode=1;}

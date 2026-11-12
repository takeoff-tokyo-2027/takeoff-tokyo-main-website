import {readFileSync,writeFileSync,existsSync} from 'node:fs';import {parseEnv} from 'node:util';import {randomBytes} from 'node:crypto';
import {sandboxKey} from './sandbox-key.mjs';
try{
 const target='.env.staging.local';if(existsSync(target))throw new Error('Staging configuration already exists; edit it explicitly rather than overwriting credentials');
 const baseline=parseEnv(readFileSync('.env','utf8'));const site=process.argv[2]||'';
 if(site&&(!site.startsWith('https://')||site===baseline.SITE_URL))throw new Error('Use a distinct HTTPS staging hostname');
 const values={VITE_APP_ENV:'staging',VITE_SUPABASE_URL:baseline.VITE_SUPABASE_URL,VITE_SUPABASE_ANON_KEY:baseline.VITE_SUPABASE_ANON_KEY,APP_ENV:'staging',SUPABASE_DB_SCHEMA:'staging',SUPABASE_URL:baseline.SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY:baseline.SUPABASE_SERVICE_ROLE_KEY,SITE_URL:site,STRIPE_SECRET_KEY:sandboxKey(baseline),STRIPE_WEBHOOK_SECRET:'',QR_SIGNING_SECRET:randomBytes(32).toString('hex'),BREVO_API_KEY:baseline.BREVO_API_KEY||'',BREVO_SENDER_EMAIL:baseline.BREVO_SENDER_EMAIL||'',STAGING_EMAIL_ALLOWLIST:''};
 writeFileSync(target,Object.entries(values).map(([k,v])=>`${k}=${JSON.stringify(v||'')}`).join('\n')+'\n',{mode:0o600});
 console.log('Prepared ignored staging configuration. Set staging SITE_URL, sandbox webhook secret and email allowlist before deployment. Workspace sandbox .env is unchanged.');
}catch(e){console.error(e.message);process.exitCode=1;}

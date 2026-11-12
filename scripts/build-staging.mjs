import {readFileSync} from 'node:fs';
import {parseEnv} from 'node:util';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {databaseSchema,stripeSecret} from '../functions/lib/environment.js';
try{
 const env=parseEnv(readFileSync('.env.staging.local','utf8'));
 if(env.APP_ENV!=='staging'||env.VITE_APP_ENV!=='staging'||!env.VITE_SUPABASE_ANON_KEY||env.VITE_SUPABASE_URL!==env.SUPABASE_URL)throw new Error('Provide explicit matching staging settings in .env.staging.local');
 databaseSchema(env);if(env.STRIPE_SECRET_KEY)stripeSecret(env);
 if(!env.SITE_URL?.startsWith('https://')||env.SITE_URL.includes('YOUR-'))throw new Error('Set the actual hosted staging SITE_URL');
 execFileSync(resolve('node_modules/.bin/vite'),['build','--mode','staging','--outDir','dist-staging'],{stdio:'inherit',env:{...process.env,...env}});
}catch(e){console.error(e.message);process.exitCode=1;}

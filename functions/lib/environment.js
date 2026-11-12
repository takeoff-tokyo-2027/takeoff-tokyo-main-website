export function environment(env) {
 const name=env.APP_ENV||'production';
 if(!['local','staging','production'].includes(name))throw new Error('Invalid APP_ENV');
 return name;
}
export function loopback(value) {
 try { const u=new URL(value); return ['localhost','127.0.0.1','[::1]'].includes(u.hostname)&&['http:','https:'].includes(u.protocol)&&!u.username&&!u.password; } catch { return false; }
}
export function databaseSchema(env) {
 const name=environment(env),schema=env.SUPABASE_DB_SCHEMA||'public';
 if(schema!==(name==='staging'?'staging':'public'))throw new Error('Database schema does not match environment');
 if(name==='local'&&!loopback(env.SUPABASE_URL))throw new Error('Local testing cannot use a hosted Supabase URL');
 return schema;
}
export function stripeSecret(env) {
 const name=environment(env),key=env.STRIPE_SECRET_KEY||'';
 if(env.APP_ENV==='production'&&!/^(sk|rk)_live_/.test(key))throw new Error('Production requires a Stripe live key');
 if(name!=='production'&&!/^(sk|rk)_test_/.test(key))throw new Error('Non-production requires a Stripe sandbox/test key');
 return key;
}
export function matchesPayment(env,session,liveMode) {
 const name=environment(env);
 return session.metadata?.event_slug==='takeoff-tokyo-2027'&&(session.metadata?.environment||'production')===name&&(name==='production'?(env.APP_ENV==='production'?liveMode===true:true):liveMode===false);
}

export function allowedOrigin(env,request) {
 const header=request.headers.get('Origin');
 if(header===new URL(env.SITE_URL).origin)return true;
 if(environment(env)!=='staging')return false;
 const url=new URL(request.url);
 const suffix=`.${env.PAGES_PROJECT_NAME||'takeoff-tokyo-main-website'}.pages.dev`;
 return header===url.origin&&url.protocol==='https:'&&url.hostname.endsWith(suffix)&&/^(dev|[a-f0-9]{8,40})$/.test(url.hostname.slice(0,-suffix.length));
}

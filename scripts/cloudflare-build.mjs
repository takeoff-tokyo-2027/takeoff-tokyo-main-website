import {execFileSync} from 'node:child_process';import {resolve} from 'node:path';
export function branchEnvironment(branch){if(branch==='main')return 'production';if(branch==='dev')return 'staging';throw new Error('Only main (production) and dev (staging) are configured for Pages builds');}
if(process.argv[1]&&resolve(process.argv[1])===import.meta.filename){
 try{
  const name=branchEnvironment(process.env.CF_PAGES_BRANCH);
  if(!process.env.VITE_SUPABASE_URL||!process.env.VITE_SUPABASE_ANON_KEY)throw new Error('Set public Supabase build variables in the selected Cloudflare environment');
  execFileSync(resolve('node_modules/.bin/tsc'),[],{stdio:'inherit'});
  execFileSync(resolve('node_modules/.bin/vite'),['build','--mode',name],{stdio:'inherit',env:{...process.env,VITE_APP_ENV:name}});
 }catch(e){console.error(e.message);process.exitCode=1;}
}

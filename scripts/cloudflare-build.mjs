import {execFileSync} from 'node:child_process';import {resolve} from 'node:path';
export function branchEnvironment(branch){if(branch==='main')return 'production';if(branch==='dev')return 'staging';throw new Error('Only main (production) and dev (staging) are configured for Cloudflare builds');}
export function cloudflareBranch(env){
 if(env.WORKERS_CI_BRANCH&&env.CF_PAGES_BRANCH&&env.WORKERS_CI_BRANCH!==env.CF_PAGES_BRANCH)throw new Error('Cloudflare branch variables disagree');
 return env.WORKERS_CI_BRANCH||env.CF_PAGES_BRANCH;
}
if(process.argv[1]&&resolve(process.argv[1])===import.meta.filename){
 try{
  const name=branchEnvironment(cloudflareBranch(process.env));
  if(!process.env.VITE_SUPABASE_URL||!process.env.VITE_SUPABASE_ANON_KEY)throw new Error('Set public Supabase build variables in the selected Cloudflare environment');
  execFileSync(resolve('node_modules/.bin/tsc'),[],{stdio:'inherit'});
  execFileSync(resolve('node_modules/.bin/vite'),['build','--mode',name],{stdio:'inherit',env:{...process.env,VITE_APP_ENV:name}});
 }catch(e){console.error(e.message);process.exitCode=1;}
}

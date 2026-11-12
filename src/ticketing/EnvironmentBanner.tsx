export function EnvironmentBanner(){
 const env=import.meta.env.VITE_APP_ENV;
 if(env!=='local'&&env!=='staging')return null;
 return <div className="environment-banner" role="note" aria-label="Environment">{env==='local'?'Local Testing':'Staging'}</div>;
}

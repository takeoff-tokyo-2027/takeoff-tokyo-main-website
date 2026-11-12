export function EnvironmentBanner(){
 const env=import.meta.env.VITE_APP_ENV;
 if(!env||env==='production')return null;
 return <div className="environment-banner" role="note">{env==='local'?'Local testing':'Staging · Test mode'}</div>;
}

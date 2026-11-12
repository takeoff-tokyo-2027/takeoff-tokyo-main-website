export function statusLabel(value:string){
 const labels:Record<string,string>={not_applicable:'Free',needs_review:'Needs review'};
 return labels[value]||value.replaceAll('_',' ').replace(/^./,c=>c.toUpperCase());
}

// Email clients need inline styles; keep all templates on the UI package palette.
const colors={canvas:'#000000',surface:'#121217',text:'#ffffff',secondary:'#ebebee',muted:'#b3b3b3',cyan:'#2dd4bf',pink:'#fdbef3',border:'#2a2a30'};
const font="'Lato',Arial,Helvetica,sans-serif";
function escape(value){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
export function renderEmail({title,message,action,url,code,note,imageUrl}){
 const c=colors;
 return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark"><title>${escape(title)}</title></head>
<body style="margin:0;padding:0;background:${c.canvas};color:${c.text};font-family:${font};-webkit-text-size-adjust:100%">
<div style="display:none;font-size:1px;line-height:1px;max-height:0;overflow:hidden;opacity:0" aria-hidden="true">${escape(title)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="${c.canvas}" style="background:${c.canvas}"><tr><td align="center" style="padding:40px 16px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;font-family:${font}">
<tr><td style="padding:0 0 24px;color:${c.pink};font-size:18px;font-weight:400">${imageUrl?`<img src="${escape(imageUrl)}" alt="Takeoff Tokyo" width="242" height="80" style="display:block;width:242px;max-width:100%;height:auto;border:0">`:'Takeoff Tokyo'}</td></tr>
<tr><td bgcolor="${c.surface}" style="padding:32px 24px;background:${c.surface};border:1px solid ${c.border};border-radius:16px">
<h1 style="margin:0 0 20px;color:${c.text};font-family:${font};font-size:28px;line-height:1.25;font-weight:400">${escape(title)}</h1>
<p style="margin:0;color:${c.secondary};font-size:16px;line-height:1.6">${escape(message)}</p>
${code?`<div style="margin:28px 0;padding:24px 12px;background:${c.canvas};border:1px solid ${c.border};border-radius:12px;text-align:center;color:${c.cyan};font-size:36px;line-height:1.4;letter-spacing:8px;font-weight:700">${escape(code)}</div>`:''}
${action&&url?`<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:28px 0"><tr><td bgcolor="${c.cyan}" style="background:${c.cyan};border-radius:999px;text-align:center"><a href="${escape(url)}" style="display:inline-block;padding:16px 24px;color:${c.canvas};font-family:${font};font-size:16px;line-height:1.25;font-weight:700;text-decoration:none">${escape(action)}</a></td></tr></table>`:''}
${note?`<p style="margin:20px 0 0;color:${c.muted};font-size:14px;line-height:1.6">${escape(note)}</p>`:''}
</td></tr>
<tr><td style="padding:24px 0 0;color:${c.muted};font-size:13px;line-height:1.6">March 17–18, 2027</td></tr>
</table></td></tr></table></body></html>`;
}

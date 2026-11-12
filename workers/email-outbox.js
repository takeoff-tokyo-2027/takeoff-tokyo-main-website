import { renderEmail } from './email-template.js';
import { environment, loopback, databaseSchema } from '../functions/lib/environment.js';
import { rpc, required, origin } from '../functions/lib/core.js';

export function emailContent(row, site) {
  const links = {
    purchase: { subject: 'Your tickets are ready', message: 'Payment confirmed. Complete your attendee details to get your QR code.', action:'View tickets', path: `/account/tickets?order=${encodeURIComponent(row.payload.orderId || '')}` },
    transfer: { subject: 'A ticket is waiting for you', message: 'A ticket has been shared with you. Sign in with this email to accept it.', action:'Accept ticket', note:'Accept within 72 hours or before the event starts.', path: `/#transfer=${encodeURIComponent(row.payload.token || '')}` },
    accepted: { subject: 'Ticket transfer complete', message: 'The ticket now belongs to its new holder. The previous QR code no longer works.', action:'View account', path: '/account' },
    crew: { subject: 'Your Crew ticket', message: 'Your Crew ticket is ready.', action:'View ticket', path: '/account/tickets' },
  };
  const entry = links[row.template];
  if (!entry) throw new Error('Unknown email template');
  const base=new URL(site);
  if(!['http:','https:'].includes(base.protocol)||base.username||base.password)throw new Error('Invalid email site URL');
  const url=new URL(entry.path,base.origin).href;
  return {
    subject: entry.subject,
    textContent: `${entry.message}\n\n${entry.action}: ${url}${entry.note?`\n\n${entry.note}`:''}\n\nTakeoff Tokyo · March 17–18, 2027`,
    htmlContent: renderEmail({title:entry.subject,message:entry.message,action:entry.action,url,note:entry.note,imageUrl:new URL('/images/takeoff-tokyo-logo.png',base.origin).href}),
  };
}
export async function drainOutbox(env) {
  // Validate configuration before leasing any jobs.
  databaseSchema(env);
  const local=environment(env)==='local';
  if(local&&!loopback(env.LOCAL_EMAIL_URL))throw new Error('Local email requires a loopback inbox');
  if(!local){required(env,'BREVO_API_KEY');required(env,'BREVO_SENDER_EMAIL');}
  const allowed=(env.STAGING_EMAIL_ALLOWLIST||'').split(',').map(v=>v.trim().toLowerCase()).filter(Boolean);
  if(environment(env)==='staging'&&!allowed.length)throw new Error('Configure STAGING_EMAIL_ALLOWLIST before running staging emails');
  const site = origin(env);
  const rows = await rpc(env, 'claim_emails');
  await Promise.all(rows.map(async row => {
    let error = null;
    try {
      if(environment(env)==='staging'&&!allowed.includes(row.recipient.toLowerCase()))throw new Error('Recipient is not in staging allowlist');
      const content = emailContent(row, site);
      const response = await fetch(local?`${env.LOCAL_EMAIL_URL}/api/v1/send`:'https://api.brevo.com/v3/smtp/email', {
        method: 'POST', headers: { 'api-key': env.BREVO_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify(local?{From:{Email:'tickets@takeoff.local',Name:'Takeoff Tokyo testing'},To:[{Email:row.recipient}],Subject:content.subject,Text:content.textContent,HTML:content.htmlContent}:{ sender: { email: env.BREVO_SENDER_EMAIL, name: 'Takeoff Tokyo' }, to: [{ email: row.recipient }], ...content }),
      });
      if (!response.ok) throw new Error(`Brevo HTTP ${response.status}`);
    } catch (e) { error = e.message; }
    await rpc(env, 'finish_email', { p_id: row.id, p_lease: row.lease_token, p_error: error });
    if (error) console.error('Email delivery retry', row.id, error);
  }));
}
export default { async scheduled(_controller, env, ctx) { ctx.waitUntil(drainOutbox(env)); } };

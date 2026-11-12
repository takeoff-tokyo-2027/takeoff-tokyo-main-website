import { useState } from 'react';
import { TakeoffButton, TakeoffInput } from '@takeoff-tokyo/ui';
import { api, Catalog, fromMinor, Profile, Ticket, toMinor } from './client';
import { NumberInput } from '../components/NumberInput';

export function AttendeeForm({ ticket, catalog, onSaved, onCancel }: { ticket: Ticket; catalog: Catalog; onSaved: () => void; onCancel: () => void }) {
  const saved = ticket.startup || ticket.investor || {};
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [currency, setCurrency] = useState(String(saved.funding_currency || saved.investment_currency || 'JPY'));
  const currencySelect = <label>Currency<select value={currency} onChange={e => setCurrency(e.target.value)}>{catalog.currencies.map(c => <option key={c.code}>{c.code}</option>)}</select></label>;
  const input = (label: string, name: string, max = 4000) => <label>{label}<TakeoffInput name={name} maxLength={max} defaultValue={String(saved[name] || '')} /></label>;
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const data = new FormData(event.currentTarget);
      const get = (name: string) => String(data.get(name) || '').trim();
      const profile: Profile = {};
      if (ticket.type === 'startup') {
        profile.business_description = get('business_description'); profile.target_vc_types = get('target_vc_types');
        profile.funding_stage = get('funding_stage') || null;
        profile.funding_amount = toMinor(get('funding_amount'), currency); profile.funding_currency = currency;
      } else if (ticket.type === 'investor') {
        profile.investment_min = toMinor(get('investment_min'), currency); profile.investment_max = toMinor(get('investment_max'), currency);
        if (typeof profile.investment_min === 'number' && typeof profile.investment_max === 'number' && profile.investment_min > profile.investment_max) throw new Error('Minimum investment cannot exceed maximum.');
        profile.investment_currency = currency; profile.sectors = data.getAll('sectors').map(String);
        profile.other_sector = get('other_sector');
        for (const k of ['leads_deals', 'invests_internationally', 'seeking_lps']) profile[k] = get(k) === '' ? null : get(k) === 'yes';
      }
      await api(`/tickets/${ticket.id}/attendee`, 'PATCH', { name: get('name'), company: get('company'), role: get('role'), profile });
      onSaved();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <form onSubmit={save} className="ticket-form attendee-form">
    <h3>{ticket.label} attendee details</h3>
    <label>Full name *<TakeoffInput name="name" required maxLength={200} defaultValue={ticket.attendee?.full_name || ''} autoComplete="name" /></label>
    <div className="form-columns"><label>Company / fund<TakeoffInput name="company" maxLength={200} defaultValue={ticket.attendee?.company || ''} /></label>
    <label>Title / role<TakeoffInput name="role" maxLength={200} defaultValue={ticket.attendee?.role || ''} /></label></div>
    {ticket.type === 'startup' && <details className="optional-fields"><summary>Startup questionnaire <span>Optional</span></summary><fieldset><legend className="visually-hidden">Startup questionnaire</legend>
      {input('What does your business do?', 'business_description')}
      {currencySelect}
      <NumberInput label="Funding sought" name="funding_amount" min={0} step={currency === 'JPY' ? 1 : 0.01} defaultValue={fromMinor(saved.funding_amount, String(saved.funding_currency || 'JPY'))} disabled={busy} />
      <label>Funding stage<select name="funding_stage" defaultValue={String(saved.funding_stage || '')}><option value="">Prefer not to answer</option>{[['pre_seed','Pre-seed'],['seed','Seed'],['series_a','Series A'],['series_b','Series B'],['series_c_plus','Series C+'],['other','Other']].map(([v,l]) => <option value={v} key={v}>{l}</option>)}</select></label>
      {input('What types of VCs would you like to meet?', 'target_vc_types')}
    </fieldset></details>}
    {ticket.type === 'investor' && <details className="optional-fields"><summary>Investor questionnaire <span>Optional</span></summary><fieldset><legend className="visually-hidden">Investor questionnaire</legend>
      {currencySelect}
      {['investment_min','investment_max'].map((name, index) => <NumberInput key={name} label={`Typical investment — ${index ? 'maximum' : 'minimum'}`} name={name} min={0} step={currency === 'JPY' ? 1 : 0.01} defaultValue={fromMinor(saved[name], String(saved.investment_currency || 'JPY'))} disabled={busy} />)}
      <fieldset><legend>Priority sectors</legend>{catalog.sectors.map(s => <label className="ticket-checkbox" key={s.code}><input type="checkbox" name="sectors" value={s.code} defaultChecked={Array.isArray(saved.sectors) && saved.sectors.includes(s.code)} />{s.label}</label>)}</fieldset>
      {input('Other sector', 'other_sector')}
      {[['leads_deals','Open to leading a deal?'],['invests_internationally','Invest in non-Japanese startups?'],['seeking_lps','Looking for LPs?']].map(([key,label]) => <label key={key}>{label}<select name={key} defaultValue={saved[key] === true ? 'yes' : saved[key] === false ? 'no' : ''}><option value="">Prefer not to answer</option><option value="yes">Yes</option><option value="no">No</option></select></label>)}
    </fieldset></details>}
    {error && <p role="alert" className="ticket-error">{error}</p>}
    <div className="ticket-actions form-actions"><TakeoffButton type="submit" variant="cyan" disabled={busy}>{busy ? 'Saving…' : 'Save details'}</TakeoffButton><TakeoffButton type="button" variant="ghost" onClick={onCancel}>Cancel</TakeoffButton></div>
  </form>;
}

import { useEffect, useState } from 'react';
import { TakeoffBadge, TakeoffButton, TakeoffInput } from '@takeoff-tokyo/ui';
import { Link, useLocation } from 'react-router-dom';
import { AccessibleModal } from './AccessibleModal';
import type { AdminTicketType } from './TicketCatalogManager';
import { api, money } from './client';
import { NumberInput } from '../components/NumberInput';
interface Discount {
  id: string;
  code: string;
  percentage: number;
  tickets: string[];
  active: boolean;
  usage_count: number;
  deleted_at: string | null;
}
interface Use {
  order_id: string;
  email: string;
  buyer_name: string;
  paid_at: string;
  discount_percentage: number;
  discount_amount: number;
  currency: string;
  status: string;
}
export function DiscountManager() {
  const selectedId = useLocation().pathname.match(/^\/admin\/discounts\/([^/]+)/)?.[1];
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<Discount | null>(null);
  const [types, setTypes] = useState<AdminTicketType[]>([]);
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [editing, setEditing] = useState<Discount | null>(null);
  const [code, setCode] = useState('');
  const [percentage, setPercentage] = useState('10');
  const [tickets, setTickets] = useState<string[]>([]);
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [uses, setUses] = useState<{
    id: string;
    code: string;
    rows: Use[];
    offset: number;
  } | null>(null);
  async function load() {
    const result = await api<{ discounts: Discount[] }>('/admin/discounts');
    setDiscounts(result.discounts);
  }
  useEffect(() => {
    void Promise.all([
      load(),
      api<{ ticketTypes: AdminTicketType[] }>('/admin/ticket-types').then((r) =>
        setTypes(r.ticketTypes.filter((t) => t.code !== 'crew')),
      ),
    ]).catch((e) => setError(e.message));
  }, []);
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function edit(d: Discount | null) {
    setFormOpen(true);
    setEditing(d);
    setCode(d?.code || '');
    setPercentage(String(d?.percentage || 10));
    setTickets(d?.tickets || []);
    setActive(d?.active ?? true);
  }
  async function showUses(d: { id: string; code: string }, offset = 0) {
    const result = await api<{ uses: Use[] }>(`/admin/discounts/${d.id}/uses?offset=${offset}`);
    setUses({ ...d, rows: result.uses, offset });
  }
  useEffect(() => {
    const selected = discounts.find((d) => d.id === selectedId);
    if (selected) void showUses(selected).catch((e) => setError(e.message));
  }, [selectedId, discounts]);
  return (
    <section className="ticket-form">
      <div className="page-heading">
        <h1>Discount codes</h1>
        {selectedId ? (
          <Link to="/admin/discounts">← Back to discounts</Link>
        ) : (
          <TakeoffButton variant="cyan" onClick={() => edit(null)}>
            Create discount
          </TakeoffButton>
        )}
      </div>
      <AccessibleModal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Edit discount' : 'Create discount'}
      >
        <form
          className="ticket-form"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              await api(
                `/admin/discounts${editing ? `/${editing.id}` : ''}`,
                editing ? 'PATCH' : 'POST',
                { code, percentage: Number(percentage), tickets, active },
              );
              edit(null);
              setFormOpen(false);
              await load();
            });
          }}
        >
          <label>
            Discount code
            <TakeoffInput
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={40}
              required
              pattern="[A-Za-z0-9][A-Za-z0-9_-]{0,39}"
            />
          </label>
          <fieldset className="checkbox-options">
            <legend>Ticket types</legend>
            {types
              .filter((t) => !t.deleted_at || editing?.tickets.includes(t.code))
              .map((t) => (
                <label className="ticket-checkbox" key={t.code}>
                  <input
                    type="checkbox"
                    disabled={!!t.deleted_at && !tickets.includes(t.code)}
                    checked={tickets.includes(t.code)}
                    onChange={(e) =>
                      setTickets(
                        e.target.checked
                          ? [...tickets, t.code]
                          : tickets.filter((v) => v !== t.code),
                      )
                    }
                  />
                  {t.label}
                  {t.deleted_at && ' (deleted — replace)'}
                </label>
              ))}
          </fieldset>
          <NumberInput
            label="Percentage discount"
            value={percentage}
            onValueChange={setPercentage}
            min={0.01}
            max={100}
            step={0.01}
            required
            disabled={busy}
          />
          <div className="ticket-actions">
            {[10, 20, 30, 50].map((p) => (
              <TakeoffButton
                key={p}
                type="button"
                variant={p === Number(percentage) ? 'cyan' : 'secondary'}
                size="sm"
                onClick={() => setPercentage(String(p))}
              >
                {p}%
              </TakeoffButton>
            ))}
          </div>
          <label className="ticket-checkbox">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            Active
          </label>
          <div className="ticket-actions form-actions">
            <TakeoffButton type="submit" variant="cyan" disabled={busy || !tickets.length}>
              {editing ? 'Save discount' : 'Create discount'}
            </TakeoffButton>
            {editing && (
              <TakeoffButton type="button" variant="ghost" onClick={() => setFormOpen(false)}>
                Cancel edit
              </TakeoffButton>
            )}
          </div>
        </form>
        {error && (
          <p role="alert" className="ticket-error">
            {error}
          </p>
        )}
      </AccessibleModal>
      {error && (
        <p className="ticket-error" role="alert">
          {error}
        </p>
      )}
      {!discounts.length && <p>No discount codes yet.</p>}
      {discounts
        .filter((d) => !selectedId || d.id === selectedId)
        .map((d) => (
          <article className="ticket-card discount-card" key={d.id}>
            <div className="page-heading">
              <h3>{d.code}</h3>
              <TakeoffBadge variant={d.active && !d.deleted_at ? 'cyan' : 'neutral'}>
                {d.deleted_at ? 'Deleted' : d.active ? 'Active' : 'Inactive'}
              </TakeoffBadge>
            </div>
            <div className="catalog-price">
              <strong>{d.percentage}% off</strong>
              <span>{d.usage_count} paid uses</span>
            </div>
            <p>
              {d.tickets
                .map((code) => types.find((t) => t.code === code)?.label || code)
                .join(', ')}
            </p>
            <div className="ticket-actions">
              <TakeoffButton
                size="sm"
                variant="secondary"
                disabled={busy || Boolean(d.deleted_at)}
                onClick={() => edit(d)}
              >
                Edit
              </TakeoffButton>
              <Link to={`/admin/discounts/${d.id}`}>View usage emails</Link>
              <TakeoffButton
                size="sm"
                variant="danger"
                disabled={busy || d.usage_count > 0 || Boolean(d.deleted_at)}
                onClick={() => setDeleting(d)}
              >
                Delete
              </TakeoffButton>
            </div>
            {d.usage_count > 0 && <small>Used · Deletion locked</small>}
          </article>
        ))}
      {selectedId && uses && (
        <section>
          <h4>Successful uses of {uses.code}</h4>
          {!uses.rows.length && <p>No successful payments on this page.</p>}
          <div className="discount-usage">
            <table>
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Paid</th>
                  <th>Saved</th>
                  <th>Order</th>
                </tr>
              </thead>
              <tbody>
                {uses.rows.map((u) => (
                  <tr key={u.order_id}>
                    <td>
                      {u.email}
                      <small>{u.buyer_name}</small>
                    </td>
                    <td>
                      {new Date(u.paid_at).toLocaleString()}
                      <small>{u.status}</small>
                    </td>
                    <td>
                      {money(u.discount_amount, u.currency)} ({u.discount_percentage}%)
                    </td>
                    <td>{u.order_id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="ticket-actions">
            <TakeoffButton
              size="sm"
              variant="ghost"
              disabled={busy || !uses.offset}
              onClick={() => void run(() => showUses(uses, Math.max(0, uses.offset - 100)))}
            >
              Previous
            </TakeoffButton>
            <TakeoffButton
              size="sm"
              variant="ghost"
              disabled={busy || uses.rows.length < 100}
              onClick={() => void run(() => showUses(uses, uses.offset + 100))}
            >
              Next
            </TakeoffButton>
          </div>
        </section>
      )}
      <AccessibleModal
        isOpen={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title="Delete unused discount?"
      >
        {error && <p role="alert">{error}</p>}
        <TakeoffButton
          variant="danger"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              await api(`/admin/discounts/${deleting!.id}`, 'DELETE');
              setDeleting(null);
              setFormOpen(false);
              await load();
            })
          }
        >
          Delete discount
        </TakeoffButton>
      </AccessibleModal>
    </section>
  );
}

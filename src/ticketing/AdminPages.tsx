import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  TakeoffBadge,
  TakeoffButton,
  TakeoffCard,
  TakeoffInput,
  useTakeoffToast,
} from '@takeoff-tokyo/ui';
import { api } from './client';
import { AccessibleModal } from './AccessibleModal';
import { DiscountManager } from './DiscountManager';
import { TicketCatalogManager, type AdminTicketType } from './TicketCatalogManager';
import { Scanner } from './Scanner';
import { statusLabel } from './display';
interface Registration {
  id: string;
  full_name: string | null;
  email: string;
  code: string;
  status: string;
  payment_status: string;
  created_at: string;
  attendee?: Record<string, unknown>;
  startup?: Record<string, unknown>;
  investor?: Record<string, unknown>;
  purchase?: Record<string, unknown>;
  checkins?: { day: string; checked_in_at: string }[];
}
export function AdminPages({ role }: { role: 'admin' | 'checkin' }) {
  const navigate = useNavigate();
  const { showToast } = useTakeoffToast();
  const { pathname, search } = useLocation();
  const [query, setQuery] = useSearchParams();
  const crew = pathname.startsWith('/admin/crew');
  const prices = pathname.includes('ticket-types');
  const scan = pathname.includes('check-in');
  const discounts = pathname.includes('discounts');
  const id = pathname.match(/^\/admin\/(?:registrations|crew)\/([^/]+)/)?.[1];
  const [data, setData] = useState<{ tickets: Registration[]; hasMore: boolean } | null>(null);
  const [detail, setDetail] = useState<Registration | null>(null);
  const [types, setTypes] = useState<AdminTicketType[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [issue, setIssue] = useState(false);
  const [revoke, setRevoke] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    setError('');
    setData(null);
    setDetail(null);
    if (role !== 'admin' || scan || discounts || prices) return;
    let canceled = false;
    const path = id
      ? `/admin/tickets/${id}`
      : `/admin/tickets?${new URLSearchParams({ ...Object.fromEntries(query), ...(crew ? { type: 'crew' } : {}) })}`;
    void api(path)
      .then((result) => {
        if (canceled) return;
        if (id) setDetail(result as Registration);
        else setData(result as { tickets: Registration[]; hasMore: boolean });
      })
      .catch((e) => {
        if (!canceled) setError(e.message);
      });
    return () => {
      canceled = true;
    };
  }, [pathname, search, revision, role]);
  useEffect(() => {
    if (role === 'admin' && !prices)
      void api<{ ticketTypes: AdminTicketType[] }>('/admin/ticket-types')
        .then((r) => setTypes(r.ticketTypes || []))
        .catch(() => {});
  }, [role, prices]);
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await fn();
      setRevision((v) => v + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (role === 'checkin' && !scan)
    return (
      <p role="alert">
        This account only has access to <Link to="/admin/check-in">Check-in</Link>.
      </p>
    );
  if (scan) return <Scanner />;
  if (discounts) return <DiscountManager />;
  if (prices) return <TicketCatalogManager />;
  const base = crew ? '/admin/crew' : '/admin/registrations';
  return (
    <section className="ticket-form">
      <div className="page-heading">
        <h1>{crew ? 'Crew' : 'Registrations'}</h1>
        {crew && !id && (
          <TakeoffButton variant="cyan" onClick={() => setIssue(true)}>
            Issue Crew ticket
          </TakeoffButton>
        )}
      </div>
      {error && (
        <div role="alert" className="ticket-error">
          {error}
          <TakeoffButton variant="ghost" onClick={() => setRevision((v) => v + 1)}>
            Retry
          </TakeoffButton>
        </div>
      )}
      {id ? (
        <>
          {!detail && !error ? (
            <p>Loading registration…</p>
          ) : (
            detail && (
              <>
                <Link to={base + search}>← Back to list</Link>
                <TakeoffCard>
                  <h3>{detail.full_name || 'Attendee details incomplete'}</h3>
                  <p>{detail.email}</p>
                  <p>
                    {detail.code} · {detail.status} · {detail.payment_status}
                  </p>
                  <details className="record-reference">
                    <summary>Ticket reference</summary>
                    <code>{detail.id}</code>
                  </details>
                </TakeoffCard>
                {(['attendee', 'startup', 'investor', 'purchase'] as const).map(
                  (key) =>
                    detail[key] && (
                      <TakeoffCard key={key}>
                        <h3>
                          {key === 'purchase'
                            ? 'Purchase summary'
                            : key === 'attendee'
                              ? 'Attendee details'
                              : `${key} questionnaire`}
                        </h3>
                        <dl>
                          {Object.entries(detail[key]!)
                            .filter(([k]) => k !== 'ticket_id')
                            .map(([k, v]) => (
                              <div key={k}>
                                <dt>{k.replaceAll('_', ' ')}</dt>
                                <dd>
                                  {v === null
                                    ? 'Unanswered'
                                    : typeof v === 'boolean'
                                      ? v
                                        ? 'Yes'
                                        : 'No'
                                      : String(v)}
                                </dd>
                              </div>
                            ))}
                        </dl>
                      </TakeoffCard>
                    ),
                )}
                <TakeoffCard>
                  <h3>Daily check-ins · Tokyo time</h3>
                  {detail.checkins?.length ? (
                    detail.checkins.map((c) => (
                      <p key={c.day}>
                        {c.day} ·{' '}
                        {new Date(c.checked_in_at).toLocaleString('en', { timeZone: 'Asia/Tokyo' })}
                      </p>
                    ))
                  ) : (
                    <p>No check-ins recorded.</p>
                  )}
                </TakeoffCard>
                {detail.status !== 'revoked' && (
                  <TakeoffButton variant="danger" onClick={() => setRevoke(true)}>
                    Revoke ticket
                  </TakeoffButton>
                )}
              </>
            )
          )}
        </>
      ) : (
        <>
          <form
            className="panel-filters"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const q = new URLSearchParams();
              for (const [k, v] of f) if (String(v)) q.set(k, String(v));
              setQuery(q);
            }}
            key={search}
          >
            <div className="filter-search">
              <label>
                Search all registrations
                <TakeoffInput
                  name="q"
                  placeholder="Name, email or ticket reference"
                  defaultValue={query.get('q') || ''}
                />
              </label>
              <TakeoffButton variant="cyan" type="submit">
                Apply filters
              </TakeoffButton>
              <TakeoffButton variant="ghost" type="button" onClick={() => setQuery({})}>
                Clear filters
              </TakeoffButton>
            </div>
            <details
              className="filter-options"
              open={
                ['type', 'status', 'payment', 'checkin'].some((key) => !!query.get(key)) ||
                undefined
              }
            >
              <summary>Filters</summary>
              <div className="filter-fields">
                {!crew && (
                  <label>
                    Ticket type
                    <select name="type" defaultValue={query.get('type') || ''}>
                      <option value="">All types</option>
                      {types.map((t) => (
                        <option key={t.code} value={t.code}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label>
                  Ticket status
                  <select name="status" defaultValue={query.get('status') || ''}>
                    <option value="">All</option>
                    {['active', 'suspended', 'revoked'].map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Payment
                  <select name="payment" defaultValue={query.get('payment') || ''}>
                    <option value="">All</option>
                    {['paid', 'refunded', 'needs_review', 'not_applicable'].map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Event day
                  <select name="day" defaultValue={query.get('day') || '2027-03-17'}>
                    <option>2027-03-17</option>
                    <option>2027-03-18</option>
                  </select>
                </label>
                <label>
                  Admission
                  <select name="checkin" defaultValue={query.get('checkin') || ''}>
                    <option value="">All</option>
                    <option value="yes">Checked in</option>
                    <option value="no">Not checked in</option>
                  </select>
                </label>
              </div>
            </details>
          </form>
          {!data && !error ? (
            <p>Loading registrations…</p>
          ) : (
            data && (
              <>
                <div className="registration-table">
                  <table>
                    <thead>
                      <tr>
                        {['Attendee', 'Email', 'Type', 'Status', 'Payment', 'Created', ''].map(
                          (s, i) => (
                            <th scope="col" key={i}>
                              {s || <span className="visually-hidden">Actions</span>}
                            </th>
                          ),
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {data.tickets.map((t) => (
                        <tr key={t.id}>
                          <td data-label="Attendee">{t.full_name || 'Details incomplete'}</td>
                          <td data-label="Email">{t.email}</td>
                          <td data-label="Type">
                            <TakeoffBadge
                              variant={
                                t.code === 'startup'
                                  ? 'cyan'
                                  : t.code === 'investor'
                                    ? 'pink'
                                    : 'neutral'
                              }
                            >
                              {t.code}
                            </TakeoffBadge>
                          </td>
                          <td data-label="Status">{statusLabel(t.status)}</td>
                          <td data-label="Payment">{statusLabel(t.payment_status)}</td>
                          <td data-label="Created">
                            {new Date(t.created_at).toLocaleDateString()}
                          </td>
                          <td>
                            <Link to={`${base}/${t.id}${search}`}>View</Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!data.tickets.length && <p>No registrations match these filters.</p>}
                <div className="ticket-actions table-pagination">
                  <TakeoffButton
                    variant="secondary"
                    disabled={!Number(query.get('offset') || 0)}
                    onClick={() => {
                      const q = new URLSearchParams(query);
                      q.set('offset', String(Math.max(0, Number(q.get('offset') || 0) - 100)));
                      setQuery(q);
                    }}
                  >
                    Previous
                  </TakeoffButton>
                  <span>
                    Page {Math.floor(Number(query.get('offset') || 0) / 100) + 1} ·{' '}
                    {data.tickets.length} records
                  </span>
                  <TakeoffButton
                    variant="secondary"
                    disabled={!data.hasMore}
                    onClick={() => {
                      const q = new URLSearchParams(query);
                      q.set('offset', String(Number(q.get('offset') || 0) + 100));
                      setQuery(q);
                    }}
                  >
                    Next
                  </TakeoffButton>
                </div>
              </>
            )
          )}
        </>
      )}
      <AccessibleModal isOpen={issue} onClose={() => setIssue(false)} title="Issue Crew ticket">
        <form
          className="ticket-form"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            void run(async () => {
              const created = await api<{ id: string }>('/admin/crew-tickets', 'POST', {
                name: f.get('name'),
                email: f.get('email'),
              });
              setIssue(false);
              showToast({ message: 'Crew ticket issued', type: 'success' });
              navigate(`/admin/crew/${created.id}`);
            });
          }}
        >
          <label>
            Name
            <TakeoffInput name="name" required maxLength={200} />
          </label>
          <label>
            Email
            <TakeoffInput type="email" name="email" required />
          </label>
          {error && <p role="alert">{error}</p>}
          <TakeoffButton variant="cyan" type="submit" disabled={busy}>
            Issue ticket
          </TakeoffButton>
        </form>
      </AccessibleModal>
      <AccessibleModal isOpen={revoke} onClose={() => setRevoke(false)} title="Revoke ticket?">
        <p>Permanently revokes admission. No refund.</p>
        {error && <p role="alert">{error}</p>}
        <TakeoffButton
          variant="danger"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              await api(`/admin/tickets/${id}/revoke`, 'POST', {});
              setRevoke(false);
            })
          }
        >
          Confirm revocation
        </TakeoffButton>
      </AccessibleModal>
    </section>
  );
}

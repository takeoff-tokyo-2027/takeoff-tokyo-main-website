import { TakeoffButton } from '@takeoff-tokyo/ui';
import { type Catalog, money } from '../ticketing/client';
import '../styles/tickets.css';

const ticketBenefits: Record<string, string[]> = {
  startup: [
    'Full event access',
    'Investor discussions',
    'Pitch opportunity',
    'Tailored matchmaking',
  ],
  investor: [
    'Full event access',
    'Connect with founders',
    'Meet LPs',
    'Discover investment opportunities',
  ],
};

interface TicketsSectionProps {
  catalog: Catalog | null;
  error: string;
  onPurchase: () => void;
  onRetry: () => void;
  hasSelection: boolean;
}

export function TicketsSection({
  catalog,
  error,
  onPurchase,
  onRetry,
  hasSelection,
}: TicketsSectionProps) {
  const codes = [
    'startup',
    'investor',
    ...(catalog?.types
      .filter((t) => !['startup', 'investor'].includes(t.code))
      .map((t) => t.code) || []),
  ];

  return (
    <section id="tickets" className="tickets-section" aria-labelledby="tickets-title">
      <div className="site-container">
        <h2 id="tickets-title" className="section-title">
          Tickets
        </h2>
        {!catalog && !error && <p role="status">Loading ticket availability…</p>}
        {error && (
          <div role="alert">
            <p>Unable to load ticket availability. {error}</p>
            <TakeoffButton variant="secondary" onClick={onRetry}>
              Try again
            </TakeoffButton>
          </div>
        )}
        {catalog && !catalog.salesEnabled && <p role="status">Ticket sales are not open yet.</p>}
        <div className="ticket-offers">
          {codes.map((code) => {
            const ticket = catalog?.types.find((t) => t.code === code);
            const label = ticket?.label || (code === 'startup' ? 'Startup' : 'Investor');
            const available = !!ticket && !!catalog?.salesEnabled && !error;
            return (
              <article
                key={code}
                className={`ticket-offer${code === 'investor' ? ' ticket-offer--featured' : ''}`}
                aria-labelledby={`ticket-offer-${code}`}
              >
                <h3 id={`ticket-offer-${code}`}>{label}</h3>
                <p className="ticket-offer__price">
                  {ticket ? money(ticket.amount, ticket.currency) : 'Coming soon'}
                </p>
                <ul>
                  {(ticketBenefits[code] || ['Full event access']).map((benefit) => (
                    <li key={benefit}>{benefit}</li>
                  ))}
                </ul>
                {catalog && !ticket && (
                  <p className="ticket-offer__status">Currently unavailable</p>
                )}
                <TakeoffButton
                  variant={code === 'investor' ? 'cyan' : 'secondary'}
                  disabled={!available}
                  onClick={onPurchase}
                >
                  Get {label.toLowerCase()} ticket
                </TakeoffButton>
              </article>
            );
          })}
        </div>
        {hasSelection && catalog?.salesEnabled && (
          <TakeoffButton className="tickets-resume" variant="ghost" onClick={onPurchase}>
            Resume ticket selection
          </TakeoffButton>
        )}
      </div>
    </section>
  );
}

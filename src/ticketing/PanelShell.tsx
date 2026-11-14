import { type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { TakeoffButton } from '@takeoff-tokyo/ui';
import logo from '@takeoff-tokyo/ui/assets/takeoff_tokyo.svg';
import type { Me } from './client';
interface PanelShellProps {
  children: ReactNode;
  me: Me | null;
  email?: string;
  signOut: () => void;
}

export function PanelShell({ children, me, email, signOut }: PanelShellProps) {
  const { pathname } = useLocation();
  const isAdmin = pathname.startsWith('/admin');
  let sections: string[][];

  if (!isAdmin) {
    sections = [['/account/tickets', 'My tickets']];
    if (me?.canAccessOrders) sections.push(['/account/orders', 'Orders']);
  } else if (me?.staffRole === 'checkin') {
    sections = [['/admin/check-in', 'Check-in']];
  } else {
    sections = [
      ['/admin/registrations', 'Registrations'],
      ['/admin/crew', 'Crew'],
      ['/admin/ticket-types', 'Tickets & prices'],
      ['/admin/discounts', 'Discounts'],
      ['/admin/check-in', 'Check-in'],
    ];
  }

  return (
    <div className="panel-shell">
      <a className="skip-link" href="#panel-main">
        Skip to content
      </a>
      <header className={`panel-header${isAdmin ? ' panel-header--admin' : ''}`}>
        <div className="site-container panel-header-inner">
          <Link to="/" aria-label="Home">
            <img className="panel-logo" src={logo} height={30} alt="Takeoff Tokyo" />
          </Link>
          <div className="ticket-actions">
            {(isAdmin || me?.staffRole) && (
              <Link className="panel-switch" to={isAdmin ? '/account/tickets' : '/admin'}>
                {isAdmin ? 'Account' : 'Admin'}
              </Link>
            )}
            {email && (
              <>
                <span className="panel-email">{email}</span>
                <TakeoffButton variant="ghost" size="sm" onClick={signOut}>
                  Sign out
                </TakeoffButton>
              </>
            )}
          </div>
        </div>
      </header>
      <div
        className={
          isAdmin && me
            ? 'site-container panel-layout panel-layout--admin'
            : 'site-container panel-layout'
        }
      >
        {me && (
          <nav
            className="panel-nav"
            aria-label={isAdmin ? 'Admin navigation' : 'Account navigation'}
          >
            <div className="panel-nav-links">
              {sections.map(([to, label]) => (
                <NavLink key={to} to={to}>
                  {label}
                </NavLink>
              ))}
            </div>
          </nav>
        )}
        <main id="panel-main" className="panel-main" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}

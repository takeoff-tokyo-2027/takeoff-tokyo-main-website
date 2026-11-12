import { type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { TakeoffButton, TakeoffTokyoLogo } from '@takeoff-tokyo/ui';
import type { Me } from './client';
export function PanelShell({children,me,email,signOut}:{children:ReactNode;me:Me|null;email?:string;signOut:()=>void}){
 const {pathname}=useLocation();const admin=pathname.startsWith('/admin');
 const sections=admin?(me?.staffRole==='checkin'?[['/admin/check-in','Check-in']]:[['/admin/registrations','Registrations'],['/admin/crew','Crew'],['/admin/ticket-types','Tickets & prices'],['/admin/discounts','Discounts'],['/admin/check-in','Check-in']]):[['/account/tickets','My tickets'],...(me?.canAccessOrders?[['/account/orders','Orders']]:[])];
 return <div className="panel-shell">
  <a className="skip-link" href="#panel-main">Skip to content</a>
  <header className="panel-header"><Link to="/" aria-label="Home"><TakeoffTokyoLogo height={30}/></Link><div className="ticket-actions">
   {(admin||me?.staffRole)&&<Link className="panel-switch" to={admin?'/account/tickets':'/admin'}>{admin?'Account':'Admin'}</Link>}
   {email&&<><span className="panel-email">{email}</span><TakeoffButton variant="ghost" size="sm" onClick={signOut}>Sign out</TakeoffButton></>}
  </div></header>
  <div className={admin&&me?'panel-layout panel-layout--admin':'panel-layout'}>
   {me&&<nav className="panel-nav" aria-label={admin?'Admin navigation':'Account navigation'}><div className="panel-nav-links">{sections.map(([to,label])=><NavLink key={to} to={to}>{label}</NavLink>)}</div></nav>}
   <main id="panel-main" className="panel-main" tabIndex={-1}>{children}</main>
  </div>
 </div>;
}

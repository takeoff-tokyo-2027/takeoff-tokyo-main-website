import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { HeroVideo } from './components/HeroVideo';
import { Footer } from './components/Footer';
import { LegalPage, legalRoutes } from './pages/LegalPage';
import { Ticketing } from './ticketing/Ticketing';
import { AboutSection } from './components/AboutSection';
import { WhosJoiningSection } from './components/WhosJoiningSection';
import { NewsletterSection } from './components/NewsletterSection';

export const App: React.FC = () => {
  const { pathname } = useLocation();
  const legalDocument = legalRoutes[pathname.replace(/\/$/, '') as keyof typeof legalRoutes];

  let content;
  if (legalDocument) {
    content = <LegalPage document={legalDocument} />;
  } else if (pathname !== '/') {
    content = <Ticketing />;
  } else {
    content = (
      <main className="hero-page">
        <section className="hero-content" aria-labelledby="hero-title">
          <div className="hero-media">
            <HeroVideo />
          </div>
          <h1 id="hero-title" className="visually-hidden">
            Takeoff Tokyo
          </h1>
          <p className="event-date">March 17–18, 2027</p>
          <div className="ticket-hero-actions">
            <a
              className="takeoff-button takeoff-button--cyan takeoff-button--size-lg"
              href="#tickets"
            >
              REGISTER ↗
            </a>
            <Link className="takeoff-button takeoff-button--ghost" to="/account/tickets">
              My tickets
            </Link>
          </div>
        </section>
        <AboutSection />
        <Ticketing />
        <WhosJoiningSection />
        <NewsletterSection />
      </main>
    );
  }

  return (
    <div className="site-layout">
      {content}
      <Footer />
    </div>
  );
};

export default App;

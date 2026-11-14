import React from "react";
import { Link, useLocation } from "react-router-dom";
import backgroundVideo from "../assets/videos/takeoff-tokyo-background-video.mp4";
import { Footer } from "./components/Footer";
import { LegalPage, legalRoutes } from "./pages/LegalPage";
import { Ticketing } from "./ticketing/Ticketing";
import { AboutSection } from "./components/AboutSection";

export const App: React.FC = () => {
  const { pathname } = useLocation();
  const legalDocument = legalRoutes[pathname.replace(/\/$/, "") as keyof typeof legalRoutes];

  return (
    <div className="site-layout">
      {legalDocument ? <LegalPage document={legalDocument} /> : pathname !== "/" ? <Ticketing /> : (
        <main className="hero-page">
          <section className="hero-content" aria-labelledby="hero-title">
            <div className="hero-media">
              <video className="hero-video" autoPlay muted loop playsInline aria-hidden="true">
                <source src={backgroundVideo} type="video/mp4" />
              </video>
            </div>
            <h1 id="hero-title" className="visually-hidden">Takeoff Tokyo</h1>
            <p className="event-date">March 17–18, 2027</p>
            <div className="ticket-hero-actions">
              <a className="takeoff-button takeoff-button--cyan takeoff-button--size-lg" href="#tickets">REGISTER ↗</a>
              <Link className="takeoff-button takeoff-button--ghost" to="/account/tickets">My tickets</Link>
            </div>
          </section>
          <AboutSection />
        </main>
      )}
      <Footer />
    </div>
  );
};

export default App;

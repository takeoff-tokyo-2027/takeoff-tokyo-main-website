import React from "react";
import backgroundVideo from "../assets/videos/takeoff-tokyo-background-video.mp4";

import { Link, useLocation } from "react-router-dom";
import { Ticketing } from "./ticketing/Ticketing";
import { AboutSection } from "./components/AboutSection";

export const App: React.FC = () => {
  const portal = useLocation().pathname !== "/";
  return portal ? <Ticketing /> : (
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
    <Ticketing />
  </main>
  );
};

export default App;

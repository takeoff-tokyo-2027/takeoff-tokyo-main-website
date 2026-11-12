import React from "react";
import backgroundVideo from "../assets/videos/takeoff-tokyo-background-video.mp4";

const REGISTER_URL = "mailto:hello@takeoff-tokyo.com?subject=Takeoff%20Tokyo%202027%20Registration";

export const App: React.FC = () => (
  <main className="hero-page">
    <section className="hero-content" aria-labelledby="hero-title">
      <div className="hero-media">
        <video className="hero-video" autoPlay muted loop playsInline aria-label="Takeoff Tokyo animated logo">
          <source src={backgroundVideo} type="video/mp4" />
        </video>
      </div>
      <h1 id="hero-title" className="visually-hidden">Takeoff Tokyo</h1>
      <p className="event-date">March 17–18, 2027</p>
      <a className="takeoff-button takeoff-button--cyan takeoff-button--size-lg register-button" href={REGISTER_URL}>REGISTER <span aria-hidden="true">↗</span></a>
    </section>
  </main>
);

export default App;

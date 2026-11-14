import '../styles/intro-hero.css';
import React from 'react';
import { TakeoffButton } from '@takeoff-tokyo/ui';

export const HeroSection: React.FC = () => {
  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section className="intro-hero">
      <div className="site-container intro-hero__container">
        {/* Muted Edition Tag */}
        <div className="intro-hero__edition">
          <span className="intro-hero__badge">
            <span className="intro-hero__dot" />
            Returning in 2027
          </span>
        </div>

        {/* Main Headline strictly in TT Lakes Neue, solid white, NO gradient */}
        <h1 className="intro-hero__title">
          Asia&apos;s Flagship <br />
          Startup Conference
        </h1>

        {/* Subtitle */}
        <p className="intro-hero__copy">
          Since 2023, Takeoff Tokyo brings together the best founders, investors, and companies on
          the planet. Returning in 2027.
        </p>

        {/* Action Buttons */}
        <div className="intro-hero__actions">
          <TakeoffButton variant="cyan" size="md" onClick={() => scrollTo('newsletter')}>
            Join the Newsletter
          </TakeoffButton>
          <TakeoffButton variant="ghost" size="md" onClick={() => scrollTo('about')}>
            Learn More
          </TakeoffButton>
        </div>
      </div>
    </section>
  );
};

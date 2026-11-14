import React from 'react';
import '../styles/about.css';

export const AboutSection: React.FC = () => (
  <section id="about" className="about-section" aria-labelledby="about-title">
    <div className="site-container about-container">
      <h2 id="about-title" className="section-title">
        About
      </h2>
      <div className="about-content">
        <div className="about-copy">
          <p>
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor
            incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud
            exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
          </p>
          <p>
            Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat
            nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui
            officia deserunt mollit anim id est laborum.
          </p>
        </div>
        <iframe
          className="about-video"
          src="https://www.youtube.com/embed/cdzSZpwCk-s"
          title="Takeoff Tokyo video"
          width="560"
          height="315"
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
      </div>
    </div>
  </section>
);

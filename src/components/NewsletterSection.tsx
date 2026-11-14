import '../styles/newsletter.css';

export function NewsletterSection() {
  return (
    <section id="newsletter" className="newsletter-section" aria-labelledby="newsletter-title">
      <div className="site-container newsletter-container">
        <h2 id="newsletter-title" className="section-title">
          Newsletter
        </h2>

        <p className="newsletter-copy">
          Be the first to hear about speaker announcements, ticket drops, and pitch contest
          applications for Takeoff Tokyo 2027.
        </p>

        <div className="newsletter-card">
          {/* Substack controls the embed's theme; the surrounding card uses our site tokens. */}
          <iframe
            className="newsletter-embed"
            src="https://takeofftokyo.substack.com/embed"
            title="Subscribe to Takeoff Tokyo on Substack"
            width="480"
            height="320"
            loading="lazy"
          />

          <p className="newsletter-note">
            Subscriptions are managed by Substack. Unsubscribe at any time.
          </p>
        </div>
      </div>
    </section>
  );
}

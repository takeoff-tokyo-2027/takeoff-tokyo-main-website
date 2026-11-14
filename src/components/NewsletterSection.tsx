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

        <a
          className="takeoff-button takeoff-button--cyan takeoff-button--size-md newsletter-subscribe"
          href="https://takeofftokyo.substack.com/subscribe"
        >
          Subscribe on Substack
        </a>

        <p className="newsletter-note">
          Subscriptions are managed on Substack. Unsubscribe at any time.
        </p>
      </div>
    </section>
  );
}

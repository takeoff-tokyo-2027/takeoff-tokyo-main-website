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

        <form onSubmit={handleSubmit} className="newsletter-form">
          <div className="newsletter-field">
            <TakeoffInput
              type="email"
              placeholder="Enter your email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              focusAccent="cyan"
              required
              aria-label="Email Address"
              className="newsletter-input"
            />
          </div>
          <div className="newsletter-submit">
            <TakeoffButton type="submit" variant="cyan" size="md" isBlock isLoading={isSubmitting}>
              Subscribe
            </TakeoffButton>
          </div>
        </form>

        <p className="newsletter-note">Zero spam. Unsubscribe at any time.</p>
      </div>
    </section>
  );
}

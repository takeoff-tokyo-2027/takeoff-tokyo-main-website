import '../styles/newsletter.css';
import React, { useState } from 'react';
import { TakeoffInput, TakeoffButton, useTakeoffToast } from '@takeoff-tokyo/ui';

export const NewsletterSection: React.FC = () => {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { showToast } = useTakeoffToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      showToast({
        message: 'Please enter a valid email address.',
        type: 'warning',
      });
      return;
    }

    setIsSubmitting(true);
    // Simulate instantaneous client-side subscription for this phase
    setTimeout(() => {
      setIsSubmitting(false);
      showToast({
        message: "You're subscribed! We'll notify you as Takeoff Tokyo 2027 updates drop.",
        type: 'success',
        duration: 5000,
      });
      setEmail('');
    }, 400);
  };

  return (
    <section id="newsletter" className="newsletter-section">
      <div className="site-container newsletter-container">
        <p className="newsletter-eyebrow">Newsletter</p>

        <h2 className="section-title">Join Our Newsletter</h2>

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
          <div>
            <TakeoffButton type="submit" variant="cyan" size="md" isLoading={isSubmitting}>
              Subscribe
            </TakeoffButton>
          </div>
        </form>

        <p className="newsletter-note">Zero spam. Unsubscribe at any time.</p>
      </div>
    </section>
  );
};

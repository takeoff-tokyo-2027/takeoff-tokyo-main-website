import React, { useState } from "react";
import {
  TakeoffInput,
  TakeoffButton,
  useTakeoffToast,
} from "@takeoff-tokyo/ui";

export const NewsletterSection: React.FC = () => {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { showToast } = useTakeoffToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@")) {
      showToast({
        message: "Please enter a valid email address.",
        type: "warning",
      });
      return;
    }

    setIsSubmitting(true);
    // Simulate instantaneous client-side subscription for this phase
    setTimeout(() => {
      setIsSubmitting(false);
      showToast({
        message: "You're subscribed! We'll notify you as Takeoff Tokyo 2027 updates drop.",
        type: "success",
        duration: 5000,
      });
      setEmail("");
    }, 400);
  };

  return (
    <section
      id="newsletter"
      style={{
        padding: "7rem 0 8rem",
        position: "relative",
      }}
    >
      <div
        className="takeoff-container"
        style={{
          maxWidth: "640px",
          margin: "0 auto",
          textAlign: "center",
        }}
      >
        <p
          style={{
            fontFamily: "var(--takeoff-font-family-body)",
            fontSize: "0.8125rem",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "rgba(255, 255, 255, 0.5)",
            margin: "0 0 1rem 0",
          }}
        >
          Newsletter
        </p>

        <h2
          style={{
            fontFamily: "var(--takeoff-font-family-display-title)",
            fontSize: "clamp(1.75rem, 3.5vw, 2.5rem)",
            fontWeight: 700,
            letterSpacing: "-0.02em",
            color: "#ffffff",
            margin: "0 0 1rem 0",
            textTransform: "uppercase",
          }}
        >
          Join Our Newsletter
        </h2>

        <p
          style={{
            fontFamily: "var(--takeoff-font-family-body)",
            fontSize: "1rem",
            lineHeight: 1.7,
            color: "rgba(255, 255, 255, 0.65)",
            margin: "0 auto 2.5rem",
            maxWidth: "500px",
            fontWeight: 300,
          }}
        >
          Be the first to hear about speaker announcements, ticket drops, and
          pitch contest applications for Takeoff Tokyo 2027.
        </p>

        <form
          onSubmit={handleSubmit}
          style={{
            display: "flex",
            gap: "0.75rem",
            maxWidth: "460px",
            margin: "0 auto",
            flexDirection: "row",
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          <div style={{ flex: "1 1 260px" }}>
            <TakeoffInput
              type="email"
              placeholder="Enter your email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              focusAccent="cyan"
              required
              aria-label="Email Address"
              style={{
                width: "100%",
                boxSizing: "border-box",
                backgroundColor: "rgba(18, 18, 23, 0.8)",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                color: "#ffffff",
              }}
            />
          </div>
          <div>
            <TakeoffButton
              type="submit"
              variant="cyan"
              size="md"
              isLoading={isSubmitting}
            >
              Subscribe
            </TakeoffButton>
          </div>
        </form>

        <p
          style={{
            fontFamily: "var(--takeoff-font-family-body)",
            fontSize: "0.75rem",
            color: "rgba(255, 255, 255, 0.4)",
            marginTop: "1.25rem",
            fontWeight: 300,
          }}
        >
          Zero spam. Unsubscribe at any time.
        </p>
      </div>
    </section>
  );
};

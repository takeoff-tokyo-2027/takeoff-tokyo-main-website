import React from "react";
import { TakeoffButton } from "@takeoff-tokyo/ui";

export const HeroSection: React.FC = () => {
  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <section
      style={{
        position: "relative",
        padding: "7rem 0 6.5rem",
        textAlign: "center",
      }}
    >
      <div
        className="takeoff-container"
        style={{
          maxWidth: "840px",
          margin: "0 auto",
        }}
      >
        {/* Muted Edition Tag */}
        <div style={{ marginBottom: "2rem" }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.35rem 0.85rem",
              borderRadius: "9999px",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              backgroundColor: "rgba(255, 255, 255, 0.03)",
              color: "rgba(255, 255, 255, 0.75)",
              fontSize: "0.8125rem",
              fontFamily: "var(--takeoff-font-family-body)",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            <span
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                backgroundColor: "#2dd4bf",
                display: "inline-block",
                opacity: 0.8,
              }}
            />
            Returning in 2027
          </span>
        </div>

        {/* Main Headline strictly in TT Lakes Neue, solid white, NO gradient */}
        <h1
          style={{
            fontFamily: "var(--takeoff-font-family-display-title)",
            fontSize: "clamp(2.25rem, 5.5vw, 4.25rem)",
            fontWeight: 700,
            lineHeight: 1.12,
            letterSpacing: "-0.02em",
            color: "#ffffff",
            margin: "0 0 1.75rem 0",
            textTransform: "uppercase",
          }}
        >
          Asia&apos;s Flagship <br />
          Startup Conference
        </h1>

        {/* Subtitle */}
        <p
          style={{
            fontFamily: "var(--takeoff-font-family-body)",
            fontSize: "clamp(1rem, 1.8vw, 1.15rem)",
            lineHeight: 1.7,
            color: "rgba(255, 255, 255, 0.65)",
            margin: "0 auto 2.75rem",
            maxWidth: "620px",
            fontWeight: 300,
          }}
        >
          Since 2023, Takeoff Tokyo brings together the best founders,
          investors, and companies on the planet. Returning in 2027.
        </p>

        {/* Action Buttons */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "0.875rem",
            flexWrap: "wrap",
          }}
        >
          <TakeoffButton
            variant="cyan"
            size="md"
            onClick={() => scrollTo("newsletter")}
          >
            Join the Newsletter
          </TakeoffButton>
          <TakeoffButton
            variant="ghost"
            size="md"
            onClick={() => scrollTo("about")}
          >
            Learn More
          </TakeoffButton>
        </div>
      </div>
    </section>
  );
};

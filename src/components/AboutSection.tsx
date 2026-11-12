import React from "react";
import {
  TakeoffCard,
  TakeoffCardHeader,
  TakeoffCardTitle,
  TakeoffCardBody,
} from "@takeoff-tokyo/ui";

interface PillarItem {
  tag: string;
  title: string;
  description: string;
}

const PILLARS: PillarItem[] = [
  {
    tag: "Startups",
    title: "Close Deals & Scale",
    description:
      "Pitch on the international stage, close investment rounds with leading venture funds, and recruit exceptional talent for your core team.",
  },
  {
    tag: "Investors",
    title: "Discover Deals & LPs",
    description:
      "Connect with emerging and institutional LPs, discover high-conviction seed and growth companies, and expand deal flow across borders.",
  },
  {
    tag: "Corporations",
    title: "Open Innovation",
    description:
      "Build your open innovation platform, scout cutting-edge technology partners, and accelerate joint venture initiatives.",
  },
  {
    tag: "Talent & Students",
    title: "Unlock Your Next Career",
    description:
      "Meet high-velocity founding teams, learn from industry trailblazers, and discover opportunities at the frontier of technology.",
  },
];

export const AboutSection: React.FC = () => {
  return (
    <section
      id="about"
      style={{
        padding: "6rem 0",
        borderTop: "1px solid rgba(255, 255, 255, 0.06)",
        borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
        backgroundColor: "rgba(255, 255, 255, 0.005)",
      }}
    >
      <div className="takeoff-container">
        {/* Section Header */}
        <div
          style={{
            maxWidth: "760px",
            margin: "0 auto 3.5rem",
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
            About
          </p>
          <h2
            style={{
              fontFamily: "var(--takeoff-font-family-display-title)",
              fontSize: "clamp(1.75rem, 3.5vw, 2.5rem)",
              fontWeight: 700,
              letterSpacing: "-0.02em",
              color: "#ffffff",
              margin: "0 0 1.25rem 0",
              textTransform: "uppercase",
            }}
          >
            Your Takeoff Starts Here
          </h2>
          <p
            style={{
              fontFamily: "var(--takeoff-font-family-body)",
              fontSize: "1.0625rem",
              lineHeight: 1.7,
              color: "rgba(255, 255, 255, 0.7)",
              margin: 0,
              fontWeight: 300,
            }}
          >
            Since 2023, Takeoff Tokyo brings together the best founders,
            investors, and companies on the planet. We help startups close deals
            with investors and hire future team members, investors find LPs and
            startups, corporations build their open innovation platform, and
            jobseekers find their next career.
          </p>
        </div>

        {/* 4 Pillars Matrix */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "1.25rem",
          }}
        >
          {PILLARS.map((pillar) => (
            <TakeoffCard
              key={pillar.title}
              variant="default"
              style={{
                backgroundColor: "rgba(18, 18, 23, 0.6)",
                border: "1px solid rgba(255, 255, 255, 0.06)",
                borderRadius: "8px",
                padding: "1.5rem",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                height: "100%",
                boxSizing: "border-box",
              }}
            >
              <TakeoffCardHeader
                style={{
                  borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
                  paddingBottom: "0.75rem",
                }}
              >
                <div>
                  <span
                    style={{
                      fontFamily: "var(--takeoff-font-family-body)",
                      fontSize: "0.75rem",
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "rgba(255, 255, 255, 0.5)",
                    }}
                  >
                    {pillar.tag}
                  </span>
                  <TakeoffCardTitle
                    style={{
                      fontFamily: "var(--takeoff-font-family-heading)",
                      marginTop: "0.5rem",
                      fontSize: "1.125rem",
                      fontWeight: 600,
                      color: "#ffffff",
                    }}
                  >
                    {pillar.title}
                  </TakeoffCardTitle>
                </div>
              </TakeoffCardHeader>
              <TakeoffCardBody style={{ paddingTop: "0.75rem" }}>
                <p
                  style={{
                    fontFamily: "var(--takeoff-font-family-body)",
                    fontSize: "0.875rem",
                    lineHeight: 1.6,
                    color: "rgba(255, 255, 255, 0.6)",
                    margin: 0,
                    fontWeight: 300,
                  }}
                >
                  {pillar.description}
                </p>
              </TakeoffCardBody>
            </TakeoffCard>
          ))}
        </div>
      </div>
    </section>
  );
};

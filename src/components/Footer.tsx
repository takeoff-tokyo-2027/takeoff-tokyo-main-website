import React from "react";
import { TakeoffTokyoLogo } from "@takeoff-tokyo/ui";

const SOCIAL_LINKS = [
  { name: "X (Twitter)", href: "https://x.com/takeoff_tokyo" },
  { name: "LinkedIn", href: "https://www.linkedin.com/company/takeofftokyo" },
  { name: "Instagram", href: "https://instagram.com/takeoff_tokyo/" },
  { name: "Facebook", href: "https://www.facebook.com/takeofftokyo" },
];

export const Footer: React.FC = () => {
  return (
    <footer
      style={{
        borderTop: "1px solid rgba(255, 255, 255, 0.08)",
        padding: "4rem 0 3rem",
        backgroundColor: "#000000",
      }}
    >
      <div
        className="takeoff-container"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "2.5rem",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: "2rem",
          }}
        >
          {/* Brand & Mission Statement */}
          <div style={{ maxWidth: "360px" }}>
            <div style={{ marginBottom: "1rem" }}>
              <TakeoffTokyoLogo height={28} />
            </div>
            <p
              style={{
                fontFamily: "var(--takeoff-font-body)",
                fontSize: "0.875rem",
                lineHeight: 1.6,
                color: "#737373",
                margin: "0 0 1rem 0",
              }}
            >
              Asia&apos;s Flagship Startup Conference. Bringing together the best
              founders, investors, and companies on the planet.
            </p>
            <a
              href="mailto:hello@takeoff-tokyo.com"
              style={{
                fontFamily: "var(--takeoff-font-body)",
                fontSize: "0.875rem",
                color: "#2dd4bf",
                textDecoration: "none",
              }}
            >
              hello@takeoff-tokyo.com
            </a>
          </div>

          {/* Social Links */}
          <div>
            <h4
              style={{
                fontFamily: "var(--takeoff-font-heading)",
                fontSize: "0.875rem",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "#ffffff",
                margin: "0 0 1rem 0",
              }}
            >
              Follow Us
            </h4>
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
                display: "flex",
                flexDirection: "column",
                gap: "0.625rem",
              }}
            >
              {SOCIAL_LINKS.map((link) => (
                <li key={link.name}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      fontFamily: "var(--takeoff-font-body)",
                      fontSize: "0.875rem",
                      color: "#a3a3a3",
                      textDecoration: "none",
                      transition: "color 0.2s ease",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.color = "#ffffff")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.color = "#a3a3a3")
                    }
                  >
                    {link.name} ↗
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom Bar: Copyright & Note */}
        <div
          style={{
            borderTop: "1px solid rgba(255, 255, 255, 0.05)",
            paddingTop: "2rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "1rem",
          }}
        >
          <p
            style={{
              fontFamily: "var(--takeoff-font-body)",
              fontSize: "0.8125rem",
              color: "#525252",
              margin: 0,
            }}
          >
            © 2027 Takeoff Tokyo. All rights reserved.
          </p>
          <p
            style={{
              fontFamily: "var(--takeoff-font-body)",
              fontSize: "0.8125rem",
              color: "#525252",
              margin: 0,
            }}
          >
            Tokyo, Japan
          </p>
        </div>
      </div>
    </footer>
  );
};

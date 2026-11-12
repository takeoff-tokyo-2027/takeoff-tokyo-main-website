import React, { useState } from "react";
import { TakeoffTokyoLogo, TakeoffButton } from "@takeoff-tokyo/ui";

export const Navbar: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const scrollToSection = (id: string) => {
    setMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 100,
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
      }}
    >
      <div
        className="takeoff-container"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: "70px",
        }}
      >
        {/* Brand & Edition Badge */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <a
            href="/"
            style={{
              display: "flex",
              alignItems: "center",
              textDecoration: "none",
            }}
            aria-label="Takeoff Tokyo Home"
          >
            <TakeoffTokyoLogo height={30} />
          </a>
          <span
            style={{
              fontSize: "0.75rem",
              fontFamily: "var(--takeoff-font-family-body)",
              padding: "0.2rem 0.6rem",
              borderRadius: "9999px",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              color: "rgba(255, 255, 255, 0.6)",
              letterSpacing: "0.04em",
            }}
          >
            2027
          </span>
        </div>

        {/* Desktop Navigation */}
        <nav
          style={{
            display: "none",
            alignItems: "center",
            gap: "2rem",
          }}
          className="desktop-nav"
        >
          <button
            onClick={() => scrollToSection("about")}
            style={{
              background: "none",
              border: "none",
              color: "rgba(255, 255, 255, 0.65)",
              fontSize: "0.875rem",
              fontFamily: "var(--takeoff-font-family-body)",
              fontWeight: 400,
              cursor: "pointer",
              transition: "color 0.2s ease",
              padding: "0.5rem 0",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.color = "#ffffff")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.color = "rgba(255, 255, 255, 0.65)")
            }
          >
            About
          </button>
          <button
            onClick={() => scrollToSection("newsletter")}
            style={{
              background: "none",
              border: "none",
              color: "rgba(255, 255, 255, 0.65)",
              fontSize: "0.875rem",
              fontFamily: "var(--takeoff-font-family-body)",
              fontWeight: 400,
              cursor: "pointer",
              transition: "color 0.2s ease",
              padding: "0.5rem 0",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.color = "#ffffff")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.color = "rgba(255, 255, 255, 0.65)")
            }
          >
            Newsletter
          </button>
          <TakeoffButton
            variant="cyan"
            size="sm"
            onClick={() => scrollToSection("newsletter")}
          >
            Join Newsletter
          </TakeoffButton>
        </nav>

        {/* Mobile Hamburger Button */}
        <div className="mobile-toggle" style={{ display: "block" }}>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            style={{
              background: "transparent",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              borderRadius: "4px",
              color: "#ffffff",
              padding: "0.45rem 0.7rem",
              cursor: "pointer",
              fontSize: "1rem",
              lineHeight: 1,
            }}
            aria-label="Toggle Navigation Menu"
          >
            {mobileMenuOpen ? "✕" : "☰"}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div
          style={{
            backgroundColor: "#000000",
            borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
            padding: "1.5rem",
            display: "flex",
            flexDirection: "column",
            gap: "1.25rem",
          }}
        >
          <button
            onClick={() => scrollToSection("about")}
            style={{
              background: "none",
              border: "none",
              color: "rgba(255, 255, 255, 0.8)",
              fontSize: "1rem",
              textAlign: "left",
              fontFamily: "var(--takeoff-font-family-body)",
              cursor: "pointer",
              padding: "0.5rem 0",
            }}
          >
            About
          </button>
          <button
            onClick={() => scrollToSection("newsletter")}
            style={{
              background: "none",
              border: "none",
              color: "rgba(255, 255, 255, 0.8)",
              fontSize: "1rem",
              textAlign: "left",
              fontFamily: "var(--takeoff-font-family-body)",
              cursor: "pointer",
              padding: "0.5rem 0",
            }}
          >
            Newsletter
          </button>
          <TakeoffButton
            variant="cyan"
            size="md"
            isBlock
            onClick={() => scrollToSection("newsletter")}
          >
            Join Newsletter
          </TakeoffButton>
        </div>
      )}

      <style>{`
        @media (min-width: 768px) {
          .desktop-nav {
            display: flex !important;
          }
          .mobile-toggle {
            display: none !important;
          }
        }
      `}</style>
    </header>
  );
};

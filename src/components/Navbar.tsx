import "../styles/navbar.css";
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
    <header className="site-navbar">
      <div className="site-container site-navbar__container">
        {/* Brand & Edition Badge */}
        <div className="site-navbar__brand">
          <a
            href="/"
            className="site-navbar__home"
            aria-label="Takeoff Tokyo Home"
          >
            <TakeoffTokyoLogo height={30} />
          </a>
          <span className="site-navbar__edition">
            2027
          </span>
        </div>

        {/* Desktop Navigation */}
        <nav className="site-navbar__desktop desktop-nav">
          <button
            onClick={() => scrollToSection("about")}
            className="site-navbar__link"
          >
            About
          </button>
          <button
            onClick={() => scrollToSection("newsletter")}
            className="site-navbar__link"
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
        <div className="mobile-toggle site-navbar__toggle">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="site-navbar__toggle-button"
            aria-label="Toggle Navigation Menu"
          >
            {mobileMenuOpen ? "✕" : "☰"}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="site-navbar__drawer">
          <button
            onClick={() => scrollToSection("about")}
            className="site-navbar__drawer-link"
          >
            About
          </button>
          <button
            onClick={() => scrollToSection("newsletter")}
            className="site-navbar__drawer-link"
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
    </header>
  );
};

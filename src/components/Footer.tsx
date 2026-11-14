import { Link } from "react-router-dom";
import "../styles/footer.css";

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <p>Copyright © 2026. TAKEOFF tokyo. All rights reserved.</p>
        <nav className="footer-links" aria-label="Legal">
          <Link to="/terms-conditions">Terms &amp; Conditions</Link>
          <Link to="/privacy-policy">Privacy Policy</Link>
          <Link to="/scta">Commercial Disclosure</Link>
        </nav>
      </div>
    </footer>
  );
}

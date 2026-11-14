import React from "react";
import ReactDOM from "react-dom/client";
import "@takeoff-tokyo/ui/css";
import "./styles/tokens.css";
import "./styles/global.css";
import "./styles/typography.css";
import "./styles/layout.css";
import "./styles/hero.css";
import App from "./App";
import { EnvironmentBanner } from "./ticketing/EnvironmentBanner";
import { BrowserRouter } from "react-router-dom";
import { TakeoffToastProvider } from "@takeoff-tokyo/ui";
import { initializeAnalytics } from "./analytics";

initializeAnalytics();

const rootElement = document.getElementById("root");

if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <BrowserRouter><TakeoffToastProvider><EnvironmentBanner/><App /></TakeoffToastProvider></BrowserRouter>
    </React.StrictMode>
  );
}

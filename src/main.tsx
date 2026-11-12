import React from "react";
import ReactDOM from "react-dom/client";
import "@takeoff-tokyo/ui/css";
import "./styles/global.css";
import "./styles/hero.css";
import App from "./App";

const rootElement = document.getElementById("root");

if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

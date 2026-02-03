import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "./styles.css";
const rootElement = document.getElementById("root");
if (!rootElement) {
    throw new Error("Failed to find the root element");
}
ReactDOM.createRoot(rootElement).render(<React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>);

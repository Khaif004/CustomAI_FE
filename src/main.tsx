import { createRoot } from "react-dom/client";
import "./index.scss";
import App from "./App.tsx";

// When embedded as an iframe by the BTP Copilot SDK widget, a token may be
// passed via ?token=... query param. Store it before React renders so that
// ProtectedRoute finds it and skips the login redirect.
const _urlToken = new URLSearchParams(window.location.search).get("token");
if (_urlToken) {
  localStorage.setItem("access_token", _urlToken);
  // Clean the token out of the URL so it doesn't stay in browser history
  const cleanUrl = window.location.pathname + window.location.hash;
  window.history.replaceState({}, "", cleanUrl);
}

createRoot(document.getElementById("root")!).render(<App />);

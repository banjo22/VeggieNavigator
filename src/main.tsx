import React from "react";
import type { ErrorInfo, ReactNode } from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";

type ErrorBoundaryState = {
  error: Error | null;
};

class ErrorBoundary extends React.Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Veggie Navigator crashed", error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-screen bg-cream px-5 py-8 text-ink">
        <main className="mx-auto max-w-xl rounded-3xl bg-white p-6 shadow-soft">
          <p className="text-sm font-bold uppercase tracking-wide text-tomato">App-Fehler</p>
          <h1 className="mt-2 text-3xl font-bold">Veggie Navigator konnte nicht starten.</h1>
          <p className="mt-3 leading-7 text-ink/65">Ein lokaler Browserzustand oder ein Render-Fehler blockiert gerade die App. Setze die lokalen App-Daten zurück und lade neu.</p>
          <pre className="mt-4 max-h-48 overflow-auto rounded-2xl bg-cream p-4 text-xs text-ink/70">{this.state.error.message}</pre>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <button
              className="rounded-2xl bg-moss px-5 py-3 font-bold text-white"
              onClick={() => {
                localStorage.clear();
                sessionStorage.clear();
                window.location.href = "/";
              }}
            >
              Lokale Daten löschen
            </button>
            <button className="rounded-2xl border border-oat bg-white px-5 py-3 font-bold text-moss" onClick={() => window.location.reload()}>
              Neu laden
            </button>
          </div>
        </main>
      </div>
    );
  }
}

function renderFatalError(error: unknown) {
  const root = document.getElementById("root");
  if (!root) return;
  const message = error instanceof Error ? error.message : String(error || "Unbekannter Fehler");
  root.innerHTML = `
    <div style="min-height:100vh;background:#f7f3ea;padding:32px 20px;font-family:Inter,system-ui,sans-serif;color:#242821">
      <main style="max-width:620px;margin:0 auto;background:white;border-radius:24px;padding:24px;box-shadow:0 18px 45px rgba(54,66,49,.12)">
        <p style="margin:0 0 8px;color:#cf695c;font-weight:800;text-transform:uppercase;font-size:13px">Startfehler</p>
        <h1 style="margin:0;font-size:30px;line-height:1.15">Veggie Navigator konnte nicht geladen werden.</h1>
        <p style="line-height:1.7;color:rgba(36,40,33,.65)">Bitte einmal lokale App-Daten löschen und neu laden.</p>
        <pre style="white-space:pre-wrap;overflow:auto;background:#f7f3ea;border-radius:16px;padding:14px;font-size:12px">${escapeHtml(message)}</pre>
        <button onclick="localStorage.clear();sessionStorage.clear();location.href='/'" style="border:0;border-radius:16px;background:#4f6f52;color:white;padding:12px 18px;font-weight:800">Lokale Daten löschen</button>
      </main>
    </div>
  `;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" }[char] || char));
}

function isNonFatalRuntimeError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  return message.includes("Failed to fetch")
    || message.includes("NetworkError")
    || message.includes("Load failed")
    || message.includes("API hat leer geantwortet");
}

window.addEventListener("error", (event) => {
  const error = event.error || event.message;
  if (isNonFatalRuntimeError(error)) {
    console.warn("Non-fatal runtime error", error);
    return;
  }
  renderFatalError(error);
});
window.addEventListener("unhandledrejection", (event) => {
  if (isNonFatalRuntimeError(event.reason)) {
    console.warn("Non-fatal async error", event.reason);
    event.preventDefault();
    return;
  }
  renderFatalError(event.reason);
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);

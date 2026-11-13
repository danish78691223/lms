import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("LMS frontend rendering error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="min-h-screen grid place-items-center p-6 bg-cream">
          <section className="card max-w-xl w-full p-7">
            <h1 className="text-xl font-bold text-ink">This page could not be displayed</h1>
            <p className="text-sm text-slate-600 mt-2">
              The LMS encountered a frontend error. Reload the page. If it happens again, share the technical details below with the administrator.
            </p>
            <pre className="text-xs whitespace-pre-wrap break-words bg-slate-50 rounded-lg p-3 mt-4 text-red-700">
              {this.state.error?.message || "Unknown rendering error"}
            </pre>
            <button className="btn mt-4" onClick={() => window.location.reload()}>
              Reload LMS
            </button>
          </section>
        </main>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </React.StrictMode>
);

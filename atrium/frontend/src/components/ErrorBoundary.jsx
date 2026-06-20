import { Component } from "react";

/**
 * Catches render-time crashes anywhere in the tree and shows a friendly
 * fallback instead of a blank white screen. Logs the error so failures are
 * visible (console now; wire to a service like Sentry later).
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    // Centralised place to ship errors to a monitoring service later.
    console.error("Unhandled UI error:", error, info?.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--bg, #0E1117)",
          padding: 24,
        }}
      >
        <div
          style={{
            maxWidth: 420,
            textAlign: "center",
            background: "var(--bg-card, #161B22)",
            border: "1px solid var(--border, #30363D)",
            borderRadius: 20,
            padding: 32,
          }}
        >
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "var(--text-1, #E6EDF3)", marginBottom: 8 }}>
            Something went wrong
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-2, #9DA7B3)", marginBottom: 20, lineHeight: 1.6 }}>
            The page hit an unexpected error. Reloading usually fixes it. If it keeps happening,
            please contact <strong>hillingone@hillingdon.gov.uk</strong>.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: "var(--brand, #0D9488)",
              color: "#fff",
              border: "none",
              borderRadius: 12,
              padding: "11px 22px",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Reload page
          </button>
        </div>
      </div>
    );
  }
}

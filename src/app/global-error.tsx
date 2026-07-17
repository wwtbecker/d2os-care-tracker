"use client"; // Error boundaries must be Client Components

/**
 * App-wide fallback for errors that escape every route-level boundary.
 * global-error replaces the root layout when active, so it must render its
 * own <html> and <body>.
 */
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          display: "flex",
          minHeight: "100vh",
          alignItems: "center",
          justifyContent: "center",
          background: "#0b1220",
          color: "#e2e8f0",
        }}
      >
        <div style={{ maxWidth: 420, textAlign: "center", padding: 24 }}>
          <h2 style={{ marginBottom: 8 }}>Something went wrong</h2>
          <p style={{ fontSize: 14, color: "#94a3b8", marginBottom: 16 }}>
            An unexpected error occurred{error.digest ? ` (ref ${error.digest})` : ""}.
            Try again, or let Elliot know if it keeps happening.
          </p>
          <button
            onClick={() => unstable_retry()}
            style={{
              borderRadius: 8,
              padding: "10px 18px",
              background: "#dc2626",
              color: "white",
              border: "none",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}

"use client";

/**
 * Last-resort boundary for errors thrown in the root layout. It replaces the
 * root layout entirely, so it must render its own <html>/<body> and cannot
 * rely on globals.css — hence the inline styles.
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
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f7f8fa",
          color: "#101828",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        <title>Something went wrong • Burj Al Aweer ERP</title>
        <main
          style={{
            maxWidth: "26rem",
            padding: "1.5rem",
            textAlign: "center",
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: "10px",
          }}
        >
          <h1 style={{ fontSize: "1rem", fontWeight: 600, margin: 0 }}>
            Something went wrong
          </h1>
          <p
            style={{
              margin: "0.5rem 0 0",
              fontSize: "0.875rem",
              color: "#667085",
            }}
          >
            The application failed to load. Your data hasn&rsquo;t been changed.
          </p>
          {error.digest && (
            <p
              style={{
                margin: "0.75rem 0 0",
                fontFamily: "ui-monospace, monospace",
                fontSize: "0.6875rem",
                color: "#98a2b3",
              }}
            >
              Reference: {error.digest}
            </p>
          )}
          <button
            type="button"
            onClick={() => unstable_retry()}
            style={{
              marginTop: "1.25rem",
              height: "2.25rem",
              padding: "0 0.875rem",
              border: 0,
              borderRadius: "8px",
              background: "#2563eb",
              color: "#fff",
              fontSize: "0.875rem",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}

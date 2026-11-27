"use client";

/* Last-resort boundary for errors in the root layout itself. It REPLACES the
   root layout, so no providers (intl, theme, query) exist here — plain markup. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en" data-theme="dark">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: 48, textAlign: "center" }}>
        <h1 style={{ fontSize: 18 }}>DevDigest hit an unexpected error</h1>
        <p style={{ opacity: 0.7 }}>Reload the app to continue.</p>
        <button type="button" onClick={reset} style={{ marginTop: 16, padding: "6px 14px" }}>
          Try again
        </button>
      </body>
    </html>
  );
}

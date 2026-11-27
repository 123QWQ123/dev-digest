"use client";

/* Last-resort boundary for errors in the root layout itself. It REPLACES the
   root layout, so no providers (intl, theme, query) exist here — plain markup.
   Copy still lives in messages/: read straight from the JSON, without next-intl. */
import common from "../../messages/en/common.json";

const copy = common.globalError;

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en" data-theme="dark">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: 48, textAlign: "center" }}>
        <h1 style={{ fontSize: 18 }}>{copy.title}</h1>
        <p style={{ opacity: 0.7 }}>{copy.body}</p>
        <button type="button" onClick={reset} style={{ marginTop: 16, padding: "6px 14px" }}>
          {copy.retry}
        </button>
      </body>
    </html>
  );
}

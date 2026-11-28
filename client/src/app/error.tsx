"use client";

/* Route-level error boundary: an unexpected render/data error in any page shows
   this instead of a blank screen, with a retry that re-renders the segment.
   Expected API errors stay handled inline by each feature (ErrorState + refetch). */
import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { ErrorState } from "@devdigest/ui";

export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("common");
  useEffect(() => {
    console.error(error);
  }, [error]);
  return <ErrorState fullScreen title={t("states.error")} body={t("routeError.body")} onRetry={reset} />;
}

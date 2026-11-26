"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Icon, SeverityBadge, CategoryTag, ConfidenceNum, type Severity, type Category } from "@devdigest/ui";
import type { FindingRecord } from "@devdigest/shared";
import { lineLabel } from "../FindingCard/helpers";

/**
 * A severity counter in a timeline run row ("⊘ 2", "⚠ 1", "💡 3"). Hovering
 * (or focusing) it opens a popover listing ONLY that run's findings of this
 * severity — the critical counter never shows warnings and vice versa.
 * The popover shows a short preview; clicking a finding scrolls to it in the
 * run's review accordion below and expands it for the full details.
 *
 * Also used by the PR list's FINDINGS column, where only the counts are known
 * up front: pass `count`, fetch the findings in `onOpen`, and set `loading`
 * until they arrive.
 */

export type CountedSeverity = "CRITICAL" | "WARNING" | "SUGGESTION";

const SEV_STYLE: Record<
  CountedSeverity,
  { color: string; icon: "AlertOctagon" | "AlertTriangle" | "Lightbulb"; labelKey: string }
> = {
  CRITICAL: { color: "var(--crit)", icon: "AlertOctagon", labelKey: "criticalCount" },
  WARNING: { color: "var(--warn)", icon: "AlertTriangle", labelKey: "warningCount" },
  SUGGESTION: { color: "var(--sugg)", icon: "Lightbulb", labelKey: "suggestionCount" },
};

/** Close delay so the pointer can travel from the counter into the popover. */
const CLOSE_DELAY_MS = 120;

/** Markdown rationale → one plain-text line for the 2-line preview. */
function plainPreview(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[`*_>#]/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

export function SeverityCountPopover({
  severity,
  findings,
  count: countProp,
  loading = false,
  onOpen,
  align = "left",
  onSelect,
}: {
  severity: CountedSeverity;
  /** Findings of THIS severity only (the caller filters). */
  findings: FindingRecord[];
  /** Counter value when the findings aren't loaded yet (defaults to findings.length). */
  count?: number;
  /** Findings are being fetched — the popover shows a loading line. */
  loading?: boolean;
  /** Called when the popover opens (lazy-load hook). */
  onOpen?: () => void;
  /** Which edge of the counter the panel aligns to; "right" grows leftwards. */
  align?: "left" | "right";
  /** Counter click → no id (jump to the run); finding click → that finding's id
   *  (scroll to it in the review below and expand it). */
  onSelect?: (findingId?: string) => void;
}) {
  const t = useTranslations("prReview.timeline");
  const [open, setOpen] = React.useState(false);
  const closeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const popoverId = React.useId();
  const { color, icon, labelKey } = SEV_STYLE[severity];
  const I = Icon[icon];
  const count = countProp ?? findings.length;
  const label = t(labelKey, { count });

  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };
  const show = () => {
    cancelClose();
    setOpen(true);
    onOpen?.();
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), CLOSE_DELAY_MS);
  };
  React.useEffect(() => cancelClose, []);

  if (count === 0) return null;

  return (
    <span
      style={{ position: "relative", display: "inline-flex" }}
      onMouseEnter={show}
      onMouseLeave={scheduleClose}
      onFocus={show}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) scheduleClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") setOpen(false);
      }}
    >
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={open ? popoverId : undefined}
        onClick={() => onSelect?.()}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          background: "none",
          border: "none",
          padding: 0,
          font: "inherit",
          fontSize: 12,
          fontWeight: 600,
          color,
          cursor: "pointer",
          textDecoration: "underline",
          textDecorationStyle: "dotted",
          textUnderlineOffset: 3,
        }}
      >
        <I size={12} />
        <span className="tnum">{count}</span>
      </button>

      {open && (
        // paddingTop (not margin) keeps the hover area continuous between
        // the counter and the panel, so moving the pointer in doesn't close it.
        <div
          id={popoverId}
          role="dialog"
          aria-label={label}
          style={{
            position: "absolute",
            top: "100%",
            ...(align === "right" ? { right: -8 } : { left: -8 }),
            paddingTop: 6,
            zIndex: 30,
          }}
        >
          <div
            style={{
              width: 380,
              maxWidth: "calc(100vw - 32px)",
              maxHeight: 360,
              overflowY: "auto",
              background: "var(--bg-elevated)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              boxShadow: "var(--shadow-modal)",
              padding: 6,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "4px 8px 6px",
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "var(--text-muted)",
              }}
            >
              <I size={12} style={{ color }} />
              {label}
            </div>
            {loading && (
              <div style={{ padding: "8px", fontSize: 12, color: "var(--text-muted)" }}>{t("loadingFindings")}</div>
            )}
            {findings.map((f, i) => (
              <button
                key={f.id}
                type="button"
                onClick={() => {
                  setOpen(false);
                  onSelect?.(f.id);
                }}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                  width: "100%",
                  padding: "8px",
                  background: "none",
                  border: "none",
                  borderTop: i === 0 ? "none" : "1px solid var(--border)",
                  font: "inherit",
                  textAlign: "left",
                  cursor: onSelect ? "pointer" : "default",
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <SeverityBadge severity={f.severity as Severity} compact />
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{f.title}</span>
                  <CategoryTag category={f.category as Category} />
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="mono" style={{ fontSize: 12, color: "var(--accent-text)" }}>
                    {f.file}:{lineLabel(f)}
                  </span>
                  <ConfidenceNum value={f.confidence} />
                </span>
                {f.rationale && (
                  <span
                    style={{
                      fontSize: 12,
                      lineHeight: 1.45,
                      color: "var(--text-secondary)",
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {plainPreview(f.rationale)}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </span>
  );
}

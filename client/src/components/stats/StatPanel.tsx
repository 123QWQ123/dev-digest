/* StatPanel — titled card that groups a list or chart on a Stats tab. */
import React from "react";
import { Icon, type IconName } from "@devdigest/ui";
import { s } from "./styles";

export function StatPanel({ title, icon, children }: { title: string; icon: IconName; children: React.ReactNode }) {
  const I = Icon[icon];
  return (
    <section style={s.panel}>
      <div style={s.panelTitle}>
        <I size={13} />
        {title}
      </div>
      {children}
    </section>
  );
}

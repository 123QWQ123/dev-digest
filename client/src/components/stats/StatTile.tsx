/* StatTile — KPI tile of the Stats tabs: uppercase label, big value, optional
   unit and a right-aligned adornment (e.g. a CircularScore). */
import React from "react";
import { s } from "./styles";

export function StatTile({
  label,
  value,
  unit,
  adornment,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  unit?: string;
  adornment?: React.ReactNode;
  hint?: string;
}) {
  return (
    <div style={s.tile} title={hint}>
      <div style={s.tileHead}>
        <span style={s.tileLabel}>{label}</span>
        {adornment}
      </div>
      <div style={s.tileValue}>
        <span className="tnum">{value}</span>
        {unit && <span style={s.tileUnit}>{unit}</span>}
      </div>
    </div>
  );
}

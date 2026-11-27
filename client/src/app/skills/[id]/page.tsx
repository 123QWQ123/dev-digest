"use client";

import { useParams } from "next/navigation";
import { SkillsView } from "../_components/SkillsView";

/* Route: /skills/:id — same view with a skill selected (tab in ?tab=). */
export default function SkillPage() {
  const { id } = useParams<{ id: string }>();
  return <SkillsView selectedId={id} />;
}

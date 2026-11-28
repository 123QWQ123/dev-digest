import type { Skill } from "@devdigest/shared";

export function filterSkills(skills: Skill[], q: string): Skill[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return skills;
  return skills.filter(
    (sk) =>
      sk.name.toLowerCase().includes(needle) ||
      sk.description.toLowerCase().includes(needle) ||
      sk.type.includes(needle),
  );
}

/** Imported/community/extracted skills are someone else's instructions. */
export function isUntrusted(skill: Pick<Skill, "source">): boolean {
  return skill.source !== "manual";
}

export type DiffLine = { kind: "same" | "add" | "del"; text: string };

/** Minimal line diff (LCS). Skill bodies are small (≤ 20k chars), so O(n·m) is fine. */
export function lineDiff(before: string, after: string): DiffLine[] {
  // An empty text has no lines ("".split gives [""], which would show a phantom "- ").
  const a = before === "" ? [] : before.split("\n");
  const b = after === "" ? [] : after.split("\n");
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      dp[i]![j] = a[i] === b[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
    }
  }
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      out.push({ kind: "same", text: a[i]! });
      i++;
      j++;
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) {
      out.push({ kind: "del", text: a[i++]! });
    } else {
      out.push({ kind: "add", text: b[j++]! });
    }
  }
  while (i < a.length) out.push({ kind: "del", text: a[i++]! });
  while (j < b.length) out.push({ kind: "add", text: b[j++]! });
  return out;
}

/** Read a File as base64 (no data: prefix) for the import preview endpoint. */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("read failed"));
    reader.onload = () => {
      const url = String(reader.result ?? "");
      resolve(url.slice(url.indexOf(",") + 1));
    };
    reader.readAsDataURL(file);
  });
}

/** 1-based line numbers for the gutter (an empty text still shows line 1). */
export function lineNumbers(text: string): number[] {
  const n = text.split("\n").length;
  return Array.from({ length: n }, (_, i) => i + 1);
}

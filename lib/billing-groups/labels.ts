/** Display label for a family billed on one invoice. */
export function defaultBillingGroupLabel(names: string[]): string {
  const trimmed = names.map((n) => n.trim()).filter(Boolean);
  if (trimmed.length === 0) return "Family";
  if (trimmed.length === 1) return `${trimmed[0]} (family)`;
  if (trimmed.length === 2) return `${trimmed[0]} & ${trimmed[1]}`;
  return `${trimmed[0]} & ${trimmed.length - 1} more`;
}

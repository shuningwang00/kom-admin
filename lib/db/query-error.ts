/** User-facing message for Drizzle/postgres failures. */
export function dbErrorMessage(err: unknown, fallback = "Database error."): string {
  const parts: string[] = [];
  collectMessages(err, parts);
  const text = parts.join(" ").toLowerCase();

  if (text.includes("staff_time_off") && text.includes("does not exist")) {
    return "Staff time off is not set up on this database yet. Run migration 0017 (npm run db:push with production DATABASE_URL).";
  }
  if (text.includes("staff_availability") && text.includes("does not exist")) {
    return "Staff availability is not set up on this database yet. Run migration 0016 (npm run db:push with production DATABASE_URL).";
  }
  if (text.includes("relief_only_tutor") && text.includes("does not exist")) {
    return "Relief-only tutors are not set up on this database yet. Run migration 0018 (npm run db:push with your DATABASE_URL).";
  }
  if (text.includes("relief_tutor") && text.includes("invalid input value for enum")) {
    return "Relief tutor role is not set up on this database yet. Run migration 0019 (npm run db:push with your DATABASE_URL).";
  }


  const leaf = parts[parts.length - 1];
  return leaf || fallback;
}

function collectMessages(err: unknown, out: string[]): void {
  if (!err) return;
  if (err instanceof Error) {
    if (err.message && !err.message.startsWith("Failed query:")) {
      out.push(err.message);
    }
    collectMessages(err.cause, out);
    return;
  }
  if (typeof err === "object" && err !== null && "cause" in err) {
    collectMessages((err as { cause?: unknown }).cause, out);
  }
}

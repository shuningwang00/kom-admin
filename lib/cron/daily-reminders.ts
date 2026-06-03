import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db/index";
import { adminRosterShift, classes, siteAllowlist, trialLeads } from "@/lib/db/schema";
import { listAllScheduledMakeupsEver } from "@/lib/attendance/makeup-booking";
import { listNeedsMakeupScheduling, listReliefTutorNeededSessions } from "@/lib/attendance/makeup-hub";
import { formatClassDropdownLabel } from "@/lib/classes/display-label";
import { sendTelegramMessage } from "@/lib/telegram/send";

const FALLBACK_HANDLE = "shun1ng";

/** Current date in SGT (UTC+8), offset by days. */
function sgtDate(offsetDays = 0): string {
  const now = new Date();
  const d = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function fmtDisplayDate(iso: string): string {
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const d = new Date(iso + "T00:00:00Z");
  return `${days[d.getUTCDay()]} ${d.getUTCDate()} ${months[d.getUTCMonth()]}`;
}

export async function buildDailyReminder(): Promise<string> {
  const db = getDb();
  const today = sgtDate(0);
  const tomorrow = sgtDate(1);

  // ── 1. Admin on duty today ────────────────────────────────────────────────
  const shifts = await db
    .select({ staffEmail: adminRosterShift.staffEmail, staffName: adminRosterShift.staffName })
    .from(adminRosterShift)
    .where(and(eq(adminRosterShift.shiftDate, today), eq(adminRosterShift.published, true)));

  const dutyEmails = [...new Set(shifts.map((s) => s.staffEmail))];

  let mentionLine: string;
  if (dutyEmails.length > 0) {
    const allowlistRows = await db
      .select({ email: siteAllowlist.email, displayName: siteAllowlist.displayName, telegramHandle: siteAllowlist.telegramHandle })
      .from(siteAllowlist)
      .where(inArray(siteAllowlist.email, dutyEmails));

    const handles = allowlistRows
      .filter((r) => r.telegramHandle)
      .map((r) => `@${r.telegramHandle}`);

    if (handles.length > 0) {
      mentionLine = `Heads up ${handles.join(", ")} — you're on duty today.`;
    } else {
      const names = shifts.map((s) => s.staffName || s.staffEmail.split("@")[0]);
      mentionLine = `Heads up ${[...new Set(names)].join(", ")} — you're on duty today.`;
    }
  } else {
    mentionLine = `No admin on duty today. @${FALLBACK_HANDLE} please note.`;
  }

  // ── 2. Trials tomorrow ────────────────────────────────────────────────────
  const trialRows = await db
    .select({ name: trialLeads.name, classId: trialLeads.classId })
    .from(trialLeads)
    .where(and(eq(trialLeads.trialDate, tomorrow), eq(trialLeads.status, "active")));

  let trialsSection = "";
  if (trialRows.length > 0) {
    const classIds = trialRows.map((t) => t.classId).filter(Boolean) as string[];
    const classRows = classIds.length
      ? await db.select().from(classes).where(inArray(classes.id, classIds))
      : [];
    const classMap = new Map(classRows.map((c) => [c.id, c]));

    const lines = trialRows.map((t) => {
      const cls = t.classId ? classMap.get(t.classId) : null;
      return `  • ${t.name}${cls ? ` · ${formatClassDropdownLabel(cls)}` : ""}`;
    });
    trialsSection = `\n🧪 <b>Trials tomorrow (${trialRows.length})</b>\n${lines.join("\n")}`;
  }

  // ── 3. Make-ups tomorrow ──────────────────────────────────────────────────
  const allMakeups = await listAllScheduledMakeupsEver();
  const tomorrowMakeups = allMakeups.filter((m) => m.makeupDate === tomorrow && !m.isComplete);

  let makeupsSection = "";
  if (tomorrowMakeups.length > 0) {
    const lines = tomorrowMakeups.map((m) => {
      const time = m.timeLabel ? ` · ${m.timeLabel}` : "";
      return `  • ${m.studentName} · ${m.makeupClassLabel}${time}`;
    });
    makeupsSection = `\n💆 <b>Make-ups tomorrow (${tomorrowMakeups.length})</b>\n${lines.join("\n")}`;
  }

  // ── 4. Backlog ────────────────────────────────────────────────────────────
  const [needs, reliefNeeded] = await Promise.all([
    listNeedsMakeupScheduling(),
    listReliefTutorNeededSessions(),
  ]);

  const backlogLines: string[] = [];
  if (needs.length > 0) backlogLines.push(`Make-up to be scheduled: ${needs.length}`);
  if (reliefNeeded.length > 0) backlogLines.push(`Reliefs needed: ${reliefNeeded.length}`);
  const backlogSection = backlogLines.length
    ? `\n📋 <b>Action needed</b>\n${backlogLines.map((l) => `  ${l}`).join("\n")}`
    : "";

  const nothingSection =
    trialRows.length === 0 && tomorrowMakeups.length === 0
      ? "\n✅ Nothing scheduled for tomorrow."
      : "";

  return [
    `📅 <b>Daily digest · ${fmtDisplayDate(tomorrow)}</b>`,
    trialsSection,
    makeupsSection,
    nothingSection,
    backlogSection,
    "",
    mentionLine,
  ]
    .filter((s) => s !== "")
    .join("\n")
    .trim();
}

export async function sendDailyReminder(): Promise<void> {
  const message = await buildDailyReminder();
  await sendTelegramMessage(message);
}

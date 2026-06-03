import { jsonOk } from "@/lib/api/json";
import { getDb } from "@/lib/db/index";
import { classes } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";

export const dynamic = "force-dynamic";

const DAY_MAP: Record<string, string> = {
  monday: "mon", tuesday: "tue", wednesday: "wed",
  thursday: "thu", friday: "fri", saturday: "sat", sunday: "sun",
};

function parseTime(time: string): { startMinutes: number; endMinutes: number; timeLabel: string } {
  const m = time.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*[-–]\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (!m) return { startMinutes: 0, endMinutes: 0, timeLabel: time };
  const toMins = (h: string, min: string, ampm: string) => {
    let hr = parseInt(h, 10);
    const mn = parseInt(min || "0", 10);
    if (ampm?.toLowerCase() === "pm" && hr !== 12) hr += 12;
    if (ampm?.toLowerCase() === "am" && hr === 12) hr = 0;
    return hr * 60 + mn;
  };
  const endAmPm = m[6] || m[3] || "";
  const startAmPm = m[3] || endAmPm;
  return {
    startMinutes: toMins(m[1], m[2], startAmPm),
    endMinutes: toMins(m[4], m[5], endAmPm),
    timeLabel: time,
  };
}

function inferLevel(label: string, level: string): string {
  const text = `${label} ${level}`.toLowerCase();
  if (/jc\s*[12]|h2\s*math/i.test(text)) return text.includes("jc2") || text.includes("jc 2") ? "jc2" : "jc1";
  if (/sec\s*4|secondary\s*4/i.test(text)) return "sec4";
  if (/sec\s*3|secondary\s*3/i.test(text)) return "sec3";
  if (/sec\s*2|secondary\s*2/i.test(text)) return "sec2";
  if (/sec\s*1|secondary\s*1/i.test(text)) return "sec1";
  if (/p6|primary\s*6/i.test(text)) return "p6";
  if (/p5|primary\s*5/i.test(text)) return "p5";
  return "sec1";
}

function inferSubject(label: string): string {
  const t = label.toLowerCase();
  if (/h2\s*math/i.test(t)) return "h2-math";
  if (/a[\s-]*math/i.test(t)) return "a-math";
  if (/e[\s-]*math/i.test(t)) return "e-math";
  if (/g3\s*math|g3math/i.test(t)) return "g3-math";
  if (/psle/i.test(t)) return "psle-math";
  return "e-math";
}

export async function GET() {
  const db = getDb();
  const rows = await db
    .select()
    .from(classes)
    .where(eq(classes.isActive, true))
    .orderBy(asc(classes.weekday), asc(classes.time));

  const slots = rows.map((c) => {
    const { startMinutes, endMinutes, timeLabel } = parseTime(c.time);
    const level = inferLevel(c.label, c.level);
    const subject = inferSubject(c.label);
    const day = DAY_MAP[c.weekday] ?? c.weekday;
    const status: "open" | "full" = c.isFull ? "full" : "open";
    return {
      id: c.id,
      label: c.label,
      shortLabel: c.label,
      level,
      subject,
      day,
      startMinutes,
      endMinutes,
      timeLabel,
      status,
      tutor: c.tutor || undefined,
      description: c.description || undefined,
      feePerLesson: c.feePerLesson || undefined,
    };
  });

  return jsonOk({ slots, loadedAt: new Date().toISOString(), source: "db" });
}

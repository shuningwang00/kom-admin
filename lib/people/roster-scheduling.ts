import { slotCoversShift } from "@/lib/centre-hours";
import {
  filterAvailabilityExcludingTimeOff,
  type StaffTimeOffRecord,
} from "@/lib/people/staff-time-off";

export type RosterAvailSlot = {
  staffEmail: string;
  availDate: string;
  startTime: string;
  endTime: string;
  slotLabel?: string;
};

export type RosterStaffPick = {
  email: string;
  displayName: string;
};

export type RosterStaffAvailabilityStatus =
  | "covers_shift"
  | "available_day"
  | "time_off"
  | "no_submission";

export type RosterStaffOption = {
  email: string;
  displayName: string;
  status: RosterStaffAvailabilityStatus;
  slots: Array<{ startTime: string; endTime: string; label?: string }>;
  alreadyScheduled: boolean;
};

function staffLabel(person: RosterStaffPick): string {
  return person.displayName.trim() || person.email;
}

function isOnTimeOff(
  email: string,
  date: string,
  timeOff: StaffTimeOffRecord[],
): boolean {
  const normalized = email.trim().toLowerCase();
  return timeOff.some(
    (r) =>
      r.staffEmail.trim().toLowerCase() === normalized &&
      date >= r.startDate &&
      date <= r.endDate,
  );
}

export function buildRosterStaffOptions(
  staff: RosterStaffPick[],
  availability: RosterAvailSlot[],
  timeOff: StaffTimeOffRecord[],
  yearMonth: string,
  date: string,
  shift: { startTime: string; endTime: string },
  scheduledEmails: Iterable<string> = [],
): RosterStaffOption[] {
  const scheduled = new Set(
    [...scheduledEmails].map((e) => e.trim().toLowerCase()),
  );
  const filtered = filterAvailabilityExcludingTimeOff(
    availability,
    timeOff,
    yearMonth,
  );
  const daySlots = filtered.filter((a) => a.availDate === date);

  const statusRank: Record<RosterStaffAvailabilityStatus, number> = {
    covers_shift: 0,
    available_day: 1,
    no_submission: 2,
    time_off: 3,
  };

  const options: RosterStaffOption[] = staff.map((person) => {
    const email = person.email.trim().toLowerCase();
    const slots = daySlots
      .filter((a) => a.staffEmail.trim().toLowerCase() === email)
      .map((a) => ({
        startTime: a.startTime,
        endTime: a.endTime,
        label: a.slotLabel?.trim() || undefined,
      }));

    let status: RosterStaffAvailabilityStatus = "no_submission";
    if (isOnTimeOff(email, date, timeOff)) {
      status = "time_off";
    } else if (slots.length === 0) {
      status = "no_submission";
    } else if (
      slots.some((s) => slotCoversShift(s, shift))
    ) {
      status = "covers_shift";
    } else {
      status = "available_day";
    }

    return {
      email,
      displayName: staffLabel(person),
      status,
      slots,
      alreadyScheduled: scheduled.has(email),
    };
  });

  return options.sort((a, b) => {
    const rank = statusRank[a.status] - statusRank[b.status];
    if (rank !== 0) return rank;
    return a.displayName.localeCompare(b.displayName);
  });
}

export function defaultRosterStaffEmail(
  options: RosterStaffOption[],
): string {
  const pick =
    options.find((o) => !o.alreadyScheduled && o.status === "covers_shift") ??
    options.find((o) => !o.alreadyScheduled && o.status === "available_day");
  return pick?.email ?? "";
}

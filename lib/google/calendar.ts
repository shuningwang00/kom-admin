import { google } from "googleapis";
import type { calendar_v3 } from "googleapis";
import { getServerGoogleAuthClient } from "@/lib/google/auth";

export type KomSource = "class_session" | "calendar_event" | "admin_shift";

export type GCalEventPayload = {
  summary: string;
  description: string;
  location?: string;
  start: { dateTime?: string; date?: string; timeZone?: string };
  end: { dateTime?: string; date?: string; timeZone?: string };
  komSource: KomSource;
  komId: string;
};

async function getCalendarClient() {
  const auth = await getServerGoogleAuthClient();
  return google.calendar({ version: "v3", auth });
}

function calendarId(): string {
  const id = process.env.GOOGLE_CALENDAR_ID?.trim();
  if (!id) throw new Error("GOOGLE_CALENDAR_ID is not set.");
  return id;
}

function buildResource(p: GCalEventPayload): calendar_v3.Schema$Event {
  return {
    summary: p.summary,
    description: p.description,
    location: p.location,
    start: p.start,
    end: p.end,
    extendedProperties: {
      private: { komSource: p.komSource, komId: p.komId },
    },
  };
}

export async function upsertCalendarEvent(
  gcalEventId: string | null,
  payload: GCalEventPayload,
): Promise<string> {
  const cal = await getCalendarClient();
  const cid = calendarId();
  const resource = buildResource(payload);

  if (gcalEventId) {
    const res = await cal.events.update({
      calendarId: cid,
      eventId: gcalEventId,
      requestBody: resource,
    });
    return res.data.id!;
  }

  const res = await cal.events.insert({
    calendarId: cid,
    requestBody: resource,
  });
  return res.data.id!;
}

export async function deleteCalendarEvent(gcalEventId: string): Promise<void> {
  try {
    const cal = await getCalendarClient();
    await cal.events.delete({ calendarId: calendarId(), eventId: gcalEventId });
  } catch (err: unknown) {
    const status = (err as { code?: number })?.code;
    if (status === 404 || status === 410) return;
    throw err;
  }
}

/** List all KOM-managed events in the calendar within the given time range. */
export async function listKomEvents(
  timeMin: string,
  timeMax: string,
): Promise<Array<{ gcalEventId: string; komSource: KomSource; komId: string }>> {
  const cal = await getCalendarClient();
  const cid = calendarId();
  const results: Array<{ gcalEventId: string; komSource: KomSource; komId: string }> = [];

  const sources: KomSource[] = ["class_session", "calendar_event", "admin_shift"];

  for (const src of sources) {
    let pageToken: string | undefined;
    do {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = await (cal.events.list as any)({
        calendarId: cid,
        timeMin,
        timeMax,
        privateExtendedProperty: [`komSource=${src}`],
        singleEvents: true,
        maxResults: 250,
        pageToken,
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const ev of (res.data?.items ?? []) as any[]) {
        const priv = ev.extendedProperties?.private;
        if (priv?.komId && priv?.komSource && ev.id) {
          results.push({
            gcalEventId: ev.id as string,
            komSource: priv.komSource as KomSource,
            komId: priv.komId as string,
          });
        }
      }
      pageToken = res.data?.nextPageToken ?? undefined;
    } while (pageToken);
  }

  return results;
}

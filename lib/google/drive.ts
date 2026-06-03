import { google } from "googleapis";
import { getGoogleAuthClient } from "@/lib/google/auth";

const CLAIMS_FOLDER_NAME = "Claims";

async function getDriveClient() {
  const auth = await getGoogleAuthClient();
  return google.drive({ version: "v3", auth });
}

async function findOrCreateFolder(
  drive: ReturnType<typeof google.drive>,
  name: string,
  parentId?: string,
): Promise<string> {
  const q = parentId
    ? `name='${name}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`
    : `name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;

  const list = await drive.files.list({ q, fields: "files(id)", pageSize: 1 });
  const existing = list.data.files?.[0];
  if (existing?.id) return existing.id;

  const created = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: parentId ? [parentId] : undefined,
    },
    fields: "id",
  });
  if (!created.data.id) throw new Error("Failed to create Drive folder");
  return created.data.id;
}

/** Ensures Claims/{YYYY-MM} folder exists and returns its ID. */
export async function ensureMonthFolder(month: string): Promise<string> {
  const rootFolderId = process.env.GOOGLE_DRIVE_CLAIMS_FOLDER_ID?.trim();
  const drive = await getDriveClient();

  let parentId: string;
  if (rootFolderId) {
    parentId = rootFolderId;
  } else {
    parentId = await findOrCreateFolder(drive, CLAIMS_FOLDER_NAME);
  }

  return findOrCreateFolder(drive, month, parentId);
}

/** Uploads a receipt file to Drive and returns the file ID. */
export async function uploadReceiptToDrive(
  buffer: Buffer,
  originalName: string,
  mimeType: string,
  month: string,
): Promise<{ fileId: string; fileName: string }> {
  const drive = await getDriveClient();
  const folderId = await ensureMonthFolder(month);

  const { Readable } = await import("stream");
  const stream = Readable.from(buffer);

  const res = await drive.files.create({
    requestBody: {
      name: originalName,
      parents: [folderId],
    },
    media: {
      mimeType,
      body: stream,
    },
    fields: "id,name",
  });

  if (!res.data.id) throw new Error("Drive upload failed: no file ID returned");
  return { fileId: res.data.id, fileName: res.data.name ?? originalName };
}

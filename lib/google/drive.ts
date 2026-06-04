import { google } from "googleapis";
import { getServerGoogleAuthClient } from "@/lib/google/auth";

const CLAIMS_FOLDER_NAME = "Claims";
const INVOICES_FOLDER_NAME = "Invoices";
const RECEIPTS_FOLDER_NAME = "Receipts";

async function getDriveClient() {
  const auth = await getServerGoogleAuthClient();
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

async function uploadPdfToDrive(
  buffer: Buffer,
  fileName: string,
  month: string,
  rootEnvVar: string,
  rootFolderName: string,
): Promise<{ fileId: string; fileName: string }> {
  const drive = await getDriveClient();
  const rootId = process.env[rootEnvVar]?.trim();
  const parentId = rootId
    ? await findOrCreateFolder(drive, month, rootId)
    : await findOrCreateFolder(drive, month, await findOrCreateFolder(drive, rootFolderName));

  const { Readable } = await import("stream");
  const res = await drive.files.create({
    requestBody: { name: fileName, parents: [parentId] },
    media: { mimeType: "application/pdf", body: Readable.from(buffer) },
    fields: "id,name",
  });
  if (!res.data.id) throw new Error("Drive upload failed: no file ID returned");

  // Make the file viewable by anyone with the link (file-level only, folder unaffected)
  try {
    await drive.permissions.create({
      fileId: res.data.id,
      requestBody: { role: "reader", type: "anyone" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`PDF uploaded but could not set sharing permission: ${msg}`);
  }

  return { fileId: res.data.id, fileName: res.data.name ?? fileName };
}

export async function uploadInvoicePdfToDrive(
  buffer: Buffer,
  fileName: string,
  month: string,
): Promise<{ fileId: string; fileName: string }> {
  return uploadPdfToDrive(buffer, fileName, month, "GOOGLE_DRIVE_INVOICES_FOLDER_ID", INVOICES_FOLDER_NAME);
}

export async function uploadBillingReceiptToDrive(
  buffer: Buffer,
  fileName: string,
  month: string,
): Promise<{ fileId: string; fileName: string }> {
  return uploadPdfToDrive(buffer, fileName, month, "GOOGLE_DRIVE_RECEIPTS_FOLDER_ID", RECEIPTS_FOLDER_NAME);
}

export async function deleteFileFromDrive(fileId: string): Promise<void> {
  try {
    const drive = await getDriveClient();
    await drive.files.delete({ fileId });
  } catch {
    // Silently ignore — file may already be deleted or inaccessible
  }
}

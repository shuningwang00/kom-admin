import { getDb } from "@/lib/db/index";
import { siteSettings } from "@/lib/db/schema";
import { google } from "googleapis";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";

export const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";
export const DRIVE_FILE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const USERINFO_EMAIL_SCOPE = "https://www.googleapis.com/auth/userinfo.email";
const USERINFO_PROFILE_SCOPE =
  "https://www.googleapis.com/auth/userinfo.profile";

export type GoogleAuthMode = "sheets" | "signin";

const REFRESH_COOKIE = "kom_google_refresh";

export type GoogleAuthMethod = "service_account" | "oauth" | "none";

export function getOAuthRedirectUri(): string {
  return (
    process.env.GOOGLE_OAUTH_REDIRECT_URI ??
    "http://localhost:3002/api/auth/google/callback"
  );
}

export function createOAuthClient() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new Error(
      "GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET are required for Google sign-in.",
    );
  }
  return new google.auth.OAuth2(clientId, clientSecret, getOAuthRedirectUri());
}

export async function getRefreshTokenFromStore(): Promise<string | null> {
  const fromEnv = process.env.GOOGLE_OAUTH_REFRESH_TOKEN?.trim();
  if (fromEnv) return fromEnv;
  const jar = await cookies();
  return jar.get(REFRESH_COOKIE)?.value ?? null;
}

export async function getGoogleAuthStatus(): Promise<{
  method: GoogleAuthMethod;
  connected: boolean;
}> {
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim()) {
    return { method: "service_account", connected: true };
  }
  const refresh = await getRefreshTokenFromStore();
  if (refresh) return { method: "oauth", connected: true };
  if (
    process.env.GOOGLE_OAUTH_CLIENT_ID?.trim() &&
    process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim()
  ) {
    return { method: "oauth", connected: false };
  }
  return { method: "none", connected: false };
}

export async function getGoogleAuthClient() {
  const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (json) {
    const credentials = JSON.parse(json) as {
      client_email: string;
      private_key: string;
    };
    return new google.auth.GoogleAuth({
      credentials,
      scopes: [SHEETS_SCOPE, DRIVE_FILE_SCOPE],
    });
  }

  const refreshToken = await getRefreshTokenFromStore();
  if (!refreshToken) {
    throw new Error(
      "Google Sheets is not connected. Click 'Connect Google' on the billing page, or set GOOGLE_OAUTH_REFRESH_TOKEN in .env.local.",
    );
  }

  const oauth2 = createOAuthClient();
  oauth2.setCredentials({ refresh_token: refreshToken });
  return oauth2;
}

const GDRIVE_TOKEN_SETTING = "google_oauth_refresh_token";

export async function saveRefreshTokenToDb(refreshToken: string): Promise<void> {
  const db = getDb();
  await db
    .insert(siteSettings)
    .values({ key: GDRIVE_TOKEN_SETTING, value: refreshToken, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: siteSettings.key,
      set: { value: refreshToken, updatedAt: new Date() },
    });
}

async function getRefreshTokenFromDb(): Promise<string | null> {
  try {
    const db = getDb();
    const [row] = await db
      .select({ value: siteSettings.value })
      .from(siteSettings)
      .where(eq(siteSettings.key, GDRIVE_TOKEN_SETTING))
      .limit(1);
    return row?.value ?? null;
  } catch {
    return null;
  }
}

/**
 * Auth client for server-level Drive/Sheets operations (receipt uploads, billing exports).
 * Reads from: service account → env var → DB (set when admin clicks Connect Google) → cookie.
 * All staff share the same Drive access regardless of who is logged in.
 */
export async function getServerGoogleAuthClient() {
  const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (json) {
    const credentials = JSON.parse(json) as {
      client_email: string;
      private_key: string;
    };
    return new google.auth.GoogleAuth({
      credentials,
      scopes: [SHEETS_SCOPE, DRIVE_FILE_SCOPE],
    });
  }

  const refreshToken =
    (await getRefreshTokenFromDb()) ||
    process.env.GOOGLE_OAUTH_REFRESH_TOKEN?.trim() ||
    (await getRefreshTokenFromStore());

  if (!refreshToken) {
    throw new Error(
      "Google Drive is not configured for shared access. Go to the Billing page and click 'Connect Google'.",
    );
  }

  const oauth2 = createOAuthClient();
  oauth2.setCredentials({ refresh_token: refreshToken });
  return oauth2;
}

export function getGoogleAuthUrl(mode: GoogleAuthMode = "sheets"): string {
  const oauth2 = createOAuthClient();
  const scopes =
    mode === "signin"
      ? [SHEETS_SCOPE, DRIVE_FILE_SCOPE, USERINFO_EMAIL_SCOPE, USERINFO_PROFILE_SCOPE, "openid"]
      : [SHEETS_SCOPE, DRIVE_FILE_SCOPE];
  return oauth2.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: scopes,
    state: mode,
  });
}

export async function fetchGoogleProfile(accessToken: string): Promise<{
  email: string;
  name: string;
}> {
  const oauth2 = createOAuthClient();
  oauth2.setCredentials({ access_token: accessToken });
  const oauth2Api = google.oauth2({ version: "v2", auth: oauth2 });
  const { data } = await oauth2Api.userinfo.get();
  const email = data.email?.trim().toLowerCase() ?? "";
  if (!email) throw new Error("Google account has no email.");
  return { email, name: data.name?.trim() ?? email };
}

export async function exchangeCodeForTokens(code: string) {
  const oauth2 = createOAuthClient();
  const { tokens } = await oauth2.getToken(code);
  if (!tokens.refresh_token) {
    throw new Error(
      "No refresh token returned. Revoke app access at myaccount.google.com/permissions and try Connect Google again.",
    );
  }
  return tokens;
}

export async function setRefreshTokenCookie(refreshToken: string) {
  const jar = await cookies();
  jar.set(REFRESH_COOKIE, refreshToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

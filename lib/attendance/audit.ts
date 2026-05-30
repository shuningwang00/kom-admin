import { getDb } from "@/lib/db/index";
import { auditLogs } from "@/lib/db/schema";
import type { SessionUser } from "@/lib/auth/config";
import { roleLabel } from "@/lib/auth/access";

export async function writeAuditLog(params: {
  actor: SessionUser;
  action: string;
  entityType: string;
  entityId: string;
  before?: object;
  after?: object;
}) {
  const db = getDb();
  await db.insert(auditLogs).values({
    actorEmail: params.actor.email,
    actorRole: roleLabel(params.actor.role),
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId,
    beforeJson: JSON.stringify(params.before ?? {}),
    afterJson: JSON.stringify(params.after ?? {}),
  });
}

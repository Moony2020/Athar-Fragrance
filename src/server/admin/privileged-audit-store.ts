import "server-only";

import type { ClientSession, Db } from "mongodb";

import { parsePrivilegedAuditEventDocument, type PrivilegedAuditEventDocument } from "@/admin/privileged-audit-document";
import { databaseCollections } from "@/server/db/collections";
import { getDatabase } from "@/server/db/mongodb";

/** Append-only repository. Stage 10.1 intentionally exposes no update or delete operations. */
export class MongoPrivilegedAuditStore {
  constructor(private readonly database: () => Promise<Db> = getDatabase) {}

  async append(event: PrivilegedAuditEventDocument, session?: ClientSession): Promise<void> {
    const parsed = parsePrivilegedAuditEventDocument(event);
    await (await this.database()).collection<PrivilegedAuditEventDocument>(databaseCollections.privilegedAuditEvents).insertOne(parsed, { session });
  }
}

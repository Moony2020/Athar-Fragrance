import "server-only";

import { randomBytes } from "node:crypto";
import type { Db } from "mongodb";

import { databaseCollections } from "@/server/db/collections";
import { getDatabase } from "@/server/db/mongodb";
import { normalizeEmail } from "@/identity/contracts";
import { displayNameSchema } from "@/identity/contracts";
import type { UserDocument } from "@/identity/documents";
import { parseUserDocument } from "@/identity/parser";

function createPublicUserId(): string {
  return randomBytes(32).toString("base64url");
}

export type CreateUserRecord = {
  email: string;
  displayName?: string;
};

export class MongoUserRepository {
  constructor(private readonly database: () => Promise<Db> = getDatabase) {}

  async findByNormalizedEmail(email: string): Promise<UserDocument | null> {
    const document = await (await this.database()).collection<UserDocument>(databaseCollections.users).findOne({ normalizedEmail: normalizeEmail(email) });
    return document ? parseUserDocument(document) : null;
  }

  async findByUserId(userId: string): Promise<UserDocument | null> {
    const document = await (await this.database()).collection<UserDocument>(databaseCollections.users).findOne({ userId });
    return document ? parseUserDocument(document) : null;
  }

  async create(input: CreateUserRecord): Promise<UserDocument> {
    const now = new Date();
    const document: UserDocument = {
      _id: undefined,
      userId: createPublicUserId(),
      normalizedEmail: normalizeEmail(input.email),
      displayName: input.displayName?.trim() || normalizeEmail(input.email).split("@")[0],
      role: "customer",
      createdAt: now,
      updatedAt: now,
    };
    const collection = (await this.database()).collection<UserDocument>(databaseCollections.users);
    await collection.insertOne(document);
    return parseUserDocument(document);
  }

  async deleteByUserId(userId: string): Promise<void> {
    await (await this.database()).collection<UserDocument>(databaseCollections.users).deleteOne({ userId });
  }

  async updateDisplayName(userId: string, displayName: string): Promise<UserDocument | null> {
    const value = displayNameSchema.parse(displayName);
    const collection = (await this.database()).collection<UserDocument>(databaseCollections.users);
    const result = await collection.findOneAndUpdate(
      { userId },
      { $set: { displayName: value, updatedAt: new Date() } },
      { returnDocument: "after" },
    );
    return result ? parseUserDocument(result) : null;
  }
}

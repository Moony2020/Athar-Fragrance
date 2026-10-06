import { ObjectId } from "mongodb";

import type { UserPublic } from "./contracts";

export const userRoles = ["customer", "admin"] as const;
export type UserRole = (typeof userRoles)[number];

export type UserDocument = {
  _id?: ObjectId;
  userId: string;
  normalizedEmail: string;
  displayName?: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
};

export function toPublicUser(document: UserDocument): UserPublic {
  return { userId: document.userId, email: document.normalizedEmail, displayName: document.displayName?.trim() || document.normalizedEmail.split("@")[0] };
}

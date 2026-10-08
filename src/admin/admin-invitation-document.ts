import { ObjectId } from "mongodb";

export type AdminInvitationStatus = "pending" | "invalidated" | "consumed";
export type AdminInvitationDeliveryStatus = "pending" | "sent" | "failed";

export type AdminInvitationDocument = {
  _id?: ObjectId;
  invitationId: string;
  normalizedEmail: string;
  tokenHash: string;
  status: AdminInvitationStatus;
  deliveryStatus: AdminInvitationDeliveryStatus;
  expiresAt: Date;
  purgeAt: Date;
  consumedAt: Date | null;
  invalidatedAt: Date | null;
  deliveredAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

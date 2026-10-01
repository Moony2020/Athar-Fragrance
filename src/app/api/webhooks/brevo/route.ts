import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { MongoEmailDeliveryStore } from "@/server/email/email-delivery-store";

function authorized(request: Request): boolean {
  const expected = process.env.BREVO_WEBHOOK_TOKEN?.trim();
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!expected || !supplied) return false;
  const expectedBytes = Buffer.from(expected, "utf8");
  const suppliedBytes = Buffer.from(supplied, "utf8");
  return expectedBytes.length === suppliedBytes.length && timingSafeEqual(expectedBytes, suppliedBytes);
}

function deliveryIdFromTags(value: unknown): string | undefined {
  const tags = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
  const tag = tags.find((candidate): candidate is string => typeof candidate === "string" && candidate.startsWith("athar_delivery:"));
  return tag?.slice("athar_delivery:".length);
}

export async function POST(request: Request): Promise<Response> {
  if (!process.env.BREVO_WEBHOOK_TOKEN?.trim()) return new Response("Brevo webhook is not configured", { status: 503 });
  if (!authorized(request)) return new Response("Invalid Brevo webhook authorization", { status: 401 });
  const payload = await request.json().catch(() => null) as { event?: unknown; "message-id"?: unknown; tags?: unknown; tag?: unknown; "X-Mailin-custom"?: unknown } | null;
  if (!payload || typeof payload.event !== "string") return new Response("Invalid Brevo webhook payload", { status: 400 });
  const deliveryId = deliveryIdFromTags(payload.tags) ?? deliveryIdFromTags(payload.tag) ?? deliveryIdFromTags(payload["X-Mailin-custom"]);
  const providerMessageId = typeof payload["message-id"] === "string" ? payload["message-id"] : undefined;
  const status = payload.event.toLowerCase();
  if (!["delivered", "hard_bounce", "hardbounce", "invalid", "invalid_email", "spam", "blocked", "soft_bounce", "softbounce", "softbounced", "deferred", "error", "opened", "click", "clicked"].includes(status)) return NextResponse.json({ received: true });
  await new MongoEmailDeliveryStore().applyProviderEvent({ deliveryId, providerMessageId, status });
  return NextResponse.json({ received: true });
}

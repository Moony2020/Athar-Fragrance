import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getCapturedOrderConfirmationMessages, isOrderConfirmationTestMailerEnabled } from "@/server/email/test-order-confirmation-mailer";

function authorized(request: Request): boolean {
  if (!isOrderConfirmationTestMailerEnabled()) return false;
  const expected = process.env.ATHAR_TEST_MAIL_SECRET;
  const supplied = request.headers.get("x-athar-test-mail-secret");
  if (!expected || !supplied) return false;
  const expectedBytes = Buffer.from(expected, "utf8");
  const suppliedBytes = Buffer.from(supplied, "utf8");
  return expectedBytes.length === suppliedBytes.length && timingSafeEqual(expectedBytes, suppliedBytes);
}

export async function GET(request: Request) {
  if (!authorized(request)) return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
  return NextResponse.json({ messages: await getCapturedOrderConfirmationMessages() }, { headers: { "Cache-Control": "no-store" } });
}

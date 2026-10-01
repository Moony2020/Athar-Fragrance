import "server-only";

import { appendFile, readFile } from "node:fs/promises";
import path from "node:path";
import type { RenderedOrderConfirmationEmail } from "@/server/email/order-confirmation-email";
import type { OrderConfirmationMailer } from "@/server/auth/brevo-mailer";

declare global { var atharOrderConfirmationTestMailState: { messages: RenderedOrderConfirmationEmail[] } | undefined; }

export function isOrderConfirmationTestMailerEnabled(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.ATHAR_TEST_MAIL_ADAPTER === "1";
}

export class TestOrderConfirmationMailer implements OrderConfirmationMailer {
  async sendOrderConfirmation(message: RenderedOrderConfirmationEmail): Promise<{ providerMessageId?: string }> {
    if (!isOrderConfirmationTestMailerEnabled()) throw new Error("Test mail adapter is disabled.");
    const outboxPath = process.env.ATHAR_TEST_MAIL_OUTBOX;
    if (outboxPath) {
      if (!path.isAbsolute(outboxPath)) throw new Error("Test mail outbox path must be absolute.");
      await appendFile(outboxPath, `${JSON.stringify(message)}\n`, { encoding: "utf8", mode: 0o600 });
      return { providerMessageId: `test:${message.orderId}` };
    }
    globalThis.atharOrderConfirmationTestMailState ??= { messages: [] };
    globalThis.atharOrderConfirmationTestMailState.messages.push({ ...message });
    return { providerMessageId: `test:${message.orderId}` };
  }
}

export async function getCapturedOrderConfirmationMessages(): Promise<RenderedOrderConfirmationEmail[]> {
  const outboxPath = process.env.ATHAR_TEST_MAIL_OUTBOX;
  if (outboxPath) {
    if (!path.isAbsolute(outboxPath)) throw new Error("Test mail outbox path must be absolute.");
    try {
      const contents = await readFile(outboxPath, "utf8");
      return contents.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line) as RenderedOrderConfirmationEmail);
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return [];
      throw error;
    }
  }
  return (globalThis.atharOrderConfirmationTestMailState?.messages ?? []).map((message) => ({ ...message }));
}

"use server";

import { checkoutIdSchema } from "@/checkout/contact-address";
import { preparePayPalCheckout } from "./prepare-paypal-checkout";

export type PayPalPaymentActionState = { status: "idle" } | { status: "ready"; paymentAttemptId: string; url: string } | { status: "blocked" | "expired" | "unavailable"; message: string };

export async function preparePayPalPaymentAction(_previous: PayPalPaymentActionState, formData: FormData): Promise<PayPalPaymentActionState> {
  const checkoutId = checkoutIdSchema.safeParse(formData.get("checkoutId"));
  if (!checkoutId.success) return { status: "blocked", message: "Your checkout needs to be refreshed before payment." };
  const result = await preparePayPalCheckout(checkoutId.data);
  if (result.status === "ready") return result;
  if (result.status === "expired") return { status: "expired", message: "Your reservation has expired. Prepare your items again." };
  if (result.status === "blocked") return { status: "blocked", message: "Your bag or checkout details changed. Review them before payment." };
  return { status: "unavailable", message: "PayPal is unavailable right now. Please try again shortly." };
}

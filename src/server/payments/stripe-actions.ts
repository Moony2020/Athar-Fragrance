"use server";

import { checkoutIdSchema } from "@/checkout/contact-address";
import { prepareStripePayment } from "./prepare-stripe-payment";

export type StripePaymentActionState =
  | { status: "idle" }
  | { status: "ready"; paymentAttemptId: string; clientSecret: string }
  | { status: "blocked" | "expired" | "unavailable"; message: string };

export async function prepareStripePaymentAction(_previous: StripePaymentActionState, formData: FormData): Promise<StripePaymentActionState> {
  const checkoutId = checkoutIdSchema.safeParse(formData.get("checkoutId"));
  if (!checkoutId.success) return { status: "blocked", message: "Your checkout needs to be refreshed before payment." };
  const result = await prepareStripePayment(checkoutId.data);
  if (result.status === "ready") return result;
  if (result.status === "expired") return { status: "expired", message: "Your reservation has expired. Prepare your items again." };
  if (result.status === "blocked") return { status: "blocked", message: "Your bag or checkout details changed. Review them before payment." };
  return { status: "unavailable", message: "Secure card payment is unavailable right now. Please try again shortly." };
}

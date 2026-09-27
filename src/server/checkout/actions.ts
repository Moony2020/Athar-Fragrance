"use server";

import { refresh } from "next/cache";
import { cookies } from "next/headers";
import { DURABLE_COMMERCE_TTL_DAYS } from "@/commerce/durable-contracts";
import { checkoutContactAddressSchema, checkoutIdSchema, type CheckoutContactAddress } from "@/checkout/contact-address";
import { readCurrentCheckout } from "./read-model";
import { checkoutIdCookieName, resolveCurrentCheckoutOwner } from "./current-draft";
import { MongoCheckoutDraftStore } from "./draft-store";

export type CheckoutField = "email" | "firstName" | "lastName" | "addressLine1" | "addressLine2" | "postalCode" | "city" | "region" | "countryCode";
export type CheckoutFormState = {
  status: "idle" | "invalid" | "saved" | "blocked" | "expired" | "conflict" | "unavailable";
  message?: string;
  errors?: Partial<Record<CheckoutField, string>>;
};

const cookieMaxAge = DURABLE_COMMERCE_TTL_DAYS * 24 * 60 * 60;

function formText(data: FormData, name: string): unknown {
  const value = data.get(name);
  return typeof value === "string" ? value : undefined;
}

function fieldErrors(error: { issues: Array<{ path: PropertyKey[]; message: string }> }): Partial<Record<CheckoutField, string>> {
  const errors: Partial<Record<CheckoutField, string>> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") as CheckoutField | "contact.email";
    const field = key === "contact.email" ? "email" : key;
    if (["email", "firstName", "lastName", "addressLine1", "addressLine2", "postalCode", "city", "region", "countryCode"].includes(field)) {
      errors[field as CheckoutField] ??= issue.message;
    }
  }
  return errors;
}

export async function saveCheckoutDetailsAction(_previous: CheckoutFormState, formData: FormData): Promise<CheckoutFormState> {
  const checkoutId = checkoutIdSchema.safeParse(formText(formData, "checkoutId"));
  const revisionValue = formText(formData, "revision");
  const revision = typeof revisionValue === "string" && /^\d+$/.test(revisionValue) ? Number(revisionValue) : null;
  const input: unknown = {
    contact: { email: formText(formData, "email") },
    shippingAddress: {
      firstName: formText(formData, "firstName"),
      lastName: formText(formData, "lastName"),
      addressLine1: formText(formData, "addressLine1"),
      addressLine2: formText(formData, "addressLine2"),
      postalCode: formText(formData, "postalCode"),
      city: formText(formData, "city"),
      region: formText(formData, "region"),
      countryCode: formText(formData, "countryCode"),
    },
  };
  const parsed = checkoutContactAddressSchema.safeParse(input);
  if (!checkoutId.success || revision === null || !Number.isSafeInteger(revision) || revision < 1 || !parsed.success) {
    return {
      status: "invalid",
      message: "Please review the highlighted fields and try again.",
      errors: parsed.success ? {} : fieldErrors(parsed.error),
    };
  }

  try {
    // The checkout ID is only a reference from the form. The owner is derived
    // afresh from the server session/guest cookie and every DB lookup is scoped
    // by that owner.
    const owner = await resolveCurrentCheckoutOwner();
    if (!owner) return { status: "blocked", message: "Your bag is no longer available for checkout. Please review it again." };
    const checkout = await readCurrentCheckout();
    if (checkout.status !== "ready") return { status: "blocked", message: "Your bag has changed and can’t continue yet. Please review it again." };

    const result = await new MongoCheckoutDraftStore().save(owner, checkoutId.data, revision, parsed.data as CheckoutContactAddress);
    if (result === "not-found") return { status: "expired", message: "This checkout session has expired or changed. Reload the page and try again." };
    if (result === "conflict") return { status: "conflict", message: "These details changed in another session. Reload and try again." };

    (await cookies()).set({
      name: checkoutIdCookieName,
      value: checkoutId.data,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: cookieMaxAge,
      path: "/checkout",
    });
    refresh();
    return { status: "saved", message: "Contact and shipping address saved." };
  } catch {
    // Do not put PII or raw database errors in logs or action responses.
    return { status: "unavailable", message: "We couldn’t save your details right now. Please try again shortly." };
  }
}

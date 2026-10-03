"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { guestOrderAccessSessionCookieName, genericOrderAccessMessage, guestOrderAccessSessionTtlMs } from "@/server/orders/guest-order-access-document";
import { lookupGuestOrder } from "@/server/orders/guest-order-access-service";
export type GuestLookupActionState = { message: string | null };
export async function submitGuestOrderLookup(_previous: GuestLookupActionState, formData: FormData): Promise<GuestLookupActionState> {
  const result = await lookupGuestOrder({ orderId: formData.get("orderId"), email: formData.get("email") });
  if (!result.ok) return { message: genericOrderAccessMessage };
  (await cookies()).set(guestOrderAccessSessionCookieName, result.sessionSecret, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/orders", maxAge: guestOrderAccessSessionTtlMs / 1000 });
  redirect("/orders/guest");
}

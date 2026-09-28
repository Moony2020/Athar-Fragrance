import { NextResponse } from "next/server";
import { z } from "zod";

import { registrationInputSchema } from "@/identity/contracts";
import { registerCustomer, RegistrationError } from "@/server/auth/registration";
import { mergeGuestCommerceForUser } from "@/server/commerce/reconciliation";
import { readGuestCartId } from "@/server/commerce/guest-cookie";
import { readGuestWishlistId } from "@/server/commerce/guest-wishlist-cookie";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = registrationInputSchema.parse(body);
    const user = await registerCustomer(input);
    await mergeGuestCommerceForUser(user.userId, { cartId: await readGuestCartId(), wishlistId: await readGuestWishlistId() });
    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const message = error.issues[0]?.message || "Invalid registration details.";
      return NextResponse.json({ error: message }, { status: 400 });
    }
    if (error instanceof RegistrationError) {
      return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
    }
    return NextResponse.json({ error: "Unable to create account. Please try again." }, { status: 400 });
  }
}

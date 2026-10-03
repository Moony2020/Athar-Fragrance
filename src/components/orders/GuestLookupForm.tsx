"use client";
import { useActionState } from "react";
import { submitGuestOrderLookup, type GuestLookupActionState } from "@/app/orders/lookup/actions";
const initialState: GuestLookupActionState = { message: null };
export function GuestLookupForm() { const [state, action, pending] = useActionState(submitGuestOrderLookup, initialState); return <form action={action}>
  <label>Order number<input name="orderId" autoComplete="off" required /></label><label>Checkout email<input name="email" type="email" autoComplete="email" required /></label>
  {state.message ? <p role="alert">{state.message}</p> : null}<button type="submit" disabled={pending}>{pending ? "Checking order…" : "View order details"}</button>
</form>; }

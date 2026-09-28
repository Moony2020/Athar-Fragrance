"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/Button/Button";
import type { CheckoutDraftPublic } from "@/checkout/draft-document";
import type { ShippingMethodPublic } from "@/checkout/shipping";
import { saveShippingSelectionAction, type ShippingSelectionState } from "@/server/checkout/actions";
import { formatMoneyMinor } from "@/lib/money";

import styles from "./CheckoutDetailsForm.module.css";

const initialState: ShippingSelectionState = { status: "idle" };

export function ShippingMethodForm({ draft, methods }: { draft: CheckoutDraftPublic; methods: ShippingMethodPublic[] }) {
  const [state, formAction, pending] = useActionState(saveShippingSelectionAction, initialState);

  return <section aria-labelledby="delivery-title" className={styles.panel}>
    <div className={styles.heading}>
      <p className={styles.kicker}>DELIVERY</p>
      <h2 id="delivery-title">Choose your delivery method</h2>
      <p>Free shipping on orders from 699 kr.</p>
    </div>
    <form action={formAction} className={styles.form}>
      <input name="checkoutId" type="hidden" value={draft.checkoutId} />
      <input name="revision" type="hidden" value={draft.revision} />
      <fieldset className={styles.shippingMethods} disabled={pending}>
        <legend>Available delivery methods</legend>
        {methods.map((method) => <label className={styles.shippingMethod} key={method.shippingMethodId}>
          <input defaultChecked={draft.selectedShippingMethodId === method.shippingMethodId} name="shippingMethodId" required type="radio" value={method.shippingMethodId} />
          <span><strong>{method.label}</strong><small>{method.isFree ? "Free" : formatMoneyMinor(method.shippingAmountMinor, method.currency)}</small></span>
        </label>)}
      </fieldset>
      {state.message ? <p className={state.status === "saved" ? styles.success : styles.formMessage} role={state.status === "saved" ? "status" : "alert"}>{state.message}</p> : null}
      <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save delivery method"}</Button>
    </form>
  </section>;
}

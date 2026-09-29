"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";

import type { CheckoutDraftPublic } from "@/checkout/draft-document";
import type { ShippingMethodPublic } from "@/checkout/shipping";
import { saveShippingSelectionAction, type ShippingSelectionState } from "@/server/checkout/actions";
import { formatMoneyMinor } from "@/lib/money";

import styles from "./CheckoutDetailsForm.module.css";

const initialState: ShippingSelectionState = { status: "idle" };

export function ShippingMethodForm({ draft, methods }: { draft: CheckoutDraftPublic; methods: ShippingMethodPublic[] }) {
  const [state, formAction, pending] = useActionState(saveShippingSelectionAction, initialState);
  const router = useRouter();

  useEffect(() => {
    if (state.status === "saved") router.refresh();
  }, [router, state.status]);

  return <section aria-labelledby="delivery-title" className={styles.panel}>
    <div className={styles.heading}>
      <h2 id="delivery-title"><span className={styles.stepNumber}>3.</span> Delivery method</h2>
      <p>Choose how you would like to receive your order.</p>
    </div>
    <form action={formAction} className={styles.form}>
      <input name="checkoutId" type="hidden" value={draft.checkoutId} />
      <input name="revision" type="hidden" value={draft.revision} />
      <fieldset className={styles.shippingMethods} disabled={pending}>
        <legend>Available delivery methods</legend>
        {methods.map((method) => <label className={styles.shippingMethod} key={method.shippingMethodId}>
          <input defaultChecked={draft.selectedShippingMethodId === method.shippingMethodId} name="shippingMethodId" onChange={(event) => event.currentTarget.form?.requestSubmit()} required type="radio" value={method.shippingMethodId} />
          <span><strong>{method.label}</strong><small>{method.isFree ? "Free" : formatMoneyMinor(method.shippingAmountMinor, method.currency)}</small></span>
        </label>)}
      </fieldset>
      {pending ? <p className={styles.helper} role="status">Saving your delivery choice…</p> : null}
      {state.status !== "idle" && state.status !== "saved" && state.message ? <p className={styles.formMessage} role="alert">{state.message}</p> : null}
    </form>
  </section>;
}

"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button/Button";
import { saveCheckoutDetailsAction, type CheckoutField, type CheckoutFormState } from "@/server/checkout/actions";
import type { CheckoutDraftPublic } from "@/checkout/draft-document";
import styles from "./CheckoutDetailsForm.module.css";

const initialState: CheckoutFormState = { status: "idle" };

type Props = { draft: CheckoutDraftPublic; email: string };

export function CheckoutDetailsForm({ draft, email }: Props) {
  const [state, formAction, pending] = useActionState(saveCheckoutDetailsAction, initialState);
  const router = useRouter();
  const errors = state.errors ?? {};

  useEffect(() => {
    if (state.status === "saved") router.refresh();
  }, [router, state.status]);

  function errorProps(name: CheckoutField) {
    const error = errors[name];
    return {
      "aria-invalid": Boolean(error),
      ...(error ? { "aria-describedby": `${name}-error` } : {}),
    };
  }

  function fieldError(name: CheckoutField) {
    const error = errors[name];
    return error ? <span className={styles.fieldError} id={`${name}-error`}>{error}</span> : null;
  }

  const address = draft.shippingAddress;

  return (
      <form action={formAction} className={styles.formShell} noValidate>
        <input name="checkoutId" type="hidden" value={draft.checkoutId} />
        <input name="revision" type="hidden" value={draft.revision} />

        <section aria-labelledby="contact-information-title" className={styles.panel}>
          <div className={styles.stepHeading}><h2 id="contact-information-title"><span>1.</span> Contact information</h2><a href="/account/sign-in">Already have an account? <strong>Log in →</strong></a></div>
          <div className={styles.field}><label htmlFor="email">Email address</label><input autoComplete="email" id="email" maxLength={320} name="email" type="email" defaultValue={draft.contact?.email ?? email} {...errorProps("email")} />{fieldError("email")}</div>
          <label className={styles.subscribe}><input type="checkbox" /> <span>Keep me updated about new arrivals and exclusive offers.</span></label>
        </section>

        <section aria-labelledby="delivery-address-title" className={styles.panel}>
          <div className={styles.stepHeading}><h2 id="delivery-address-title"><span>2.</span> Delivery address</h2></div>

        <div className={styles.twoColumns}>
          <div className={styles.field}>
            <label htmlFor="firstName">First name</label>
            <input autoComplete="given-name" id="firstName" maxLength={80} name="firstName" defaultValue={address?.firstName ?? ""} {...errorProps("firstName")} />
            {fieldError("firstName")}
          </div>
          <div className={styles.field}>
            <label htmlFor="lastName">Last name</label>
            <input autoComplete="family-name" id="lastName" maxLength={80} name="lastName" defaultValue={address?.lastName ?? ""} {...errorProps("lastName")} />
            {fieldError("lastName")}
          </div>
        </div>

        <div className={styles.field}>
          <label htmlFor="addressLine1">Address line 1</label>
          <input autoComplete="address-line1" id="addressLine1" maxLength={160} name="addressLine1" defaultValue={address?.addressLine1 ?? ""} {...errorProps("addressLine1")} />
          {fieldError("addressLine1")}
        </div>
        <div className={styles.field}>
          <label htmlFor="addressLine2">Address line 2 <span>(optional)</span></label>
          <input autoComplete="address-line2" id="addressLine2" maxLength={160} name="addressLine2" defaultValue={address?.addressLine2 ?? ""} {...errorProps("addressLine2")} />
          {fieldError("addressLine2")}
        </div>

        <div className={styles.twoColumns}>
          <div className={styles.field}>
            <label htmlFor="postalCode">Postal code</label>
            <input autoComplete="postal-code" id="postalCode" maxLength={32} name="postalCode" defaultValue={address?.postalCode ?? ""} {...errorProps("postalCode")} />
            {fieldError("postalCode")}
          </div>
          <div className={styles.field}>
            <label htmlFor="city">City</label>
            <input autoComplete="address-level2" id="city" maxLength={100} name="city" defaultValue={address?.city ?? ""} {...errorProps("city")} />
            {fieldError("city")}
          </div>
        </div>

        <div className={styles.twoColumns}>
          <div className={styles.field}>
            <label htmlFor="region">Region / state <span>(optional)</span></label>
            <input autoComplete="address-level1" id="region" maxLength={100} name="region" defaultValue={address?.region ?? ""} {...errorProps("region")} />
            {fieldError("region")}
          </div>
          <div className={styles.field}>
            <label htmlFor="countryCode">Country code</label>
            <input autoComplete="country" id="countryCode" maxLength={2} name="countryCode" pattern="[A-Za-z]{2}" placeholder="SE" defaultValue={address?.countryCode ?? ""} {...errorProps("countryCode")} />
            {fieldError("countryCode")}
          </div>
        </div>
        {state.message ? <p className={state.status === "saved" ? styles.success : styles.formMessage} role={state.status === "saved" ? "status" : "alert"}>{state.message}</p> : null}
        <Button className={styles.saveBtn} disabled={pending} type="submit" variant="primary">{pending ? "Saving…" : "Save details"}</Button>
        </section>
      </form>
  );
}

"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import type { PublicCartLine } from "@/server/commerce/cart-read";
import { removeGuestCartLineAction, updateGuestCartLineAction } from "@/server/commerce/actions";
import styles from "./CartPage.module.css";

export function CartLineRemoveButton({ line }: { line: PublicCartLine }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (line.quantity <= 1) {
    return null;
  }

  const handleRemove = () => startTransition(async () => {
    const result = await removeGuestCartLineAction({ productSlug: line.productSlug, variantId: line.variantId });
    if (result.ok) {
      (window as Window & { __atharCartCount?: number }).__atharCartCount = result.totalQuantity;
      window.dispatchEvent(new CustomEvent("athar:cart-count", { detail: result.totalQuantity }));
      router.refresh();
    }
  });

  return (
    <button
      aria-label={`Remove ${line.productName ?? "item"} from bag`}
      className={styles.removeBtn}
      disabled={pending}
      onClick={handleRemove}
      title="Remove all from bag"
      type="button"
    >
      <TrashIcon size={16} />
    </button>
  );
}

export function CartLineQuantity({ line }: { line: PublicCartLine }) {
  const router = useRouter();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const mutate = (quantity?: number) => startTransition(async () => {
    const result = quantity === undefined
      ? await removeGuestCartLineAction({ productSlug: line.productSlug, variantId: line.variantId })
      : await updateGuestCartLineAction({ productSlug: line.productSlug, variantId: line.variantId, quantity });

    if (result.ok) {
      setErrorMsg(null);
      (window as Window & { __atharCartCount?: number }).__atharCartCount = result.totalQuantity;
      window.dispatchEvent(new CustomEvent("athar:cart-count", { detail: result.totalQuantity }));
      router.refresh();
    } else {
      setErrorMsg(result.message);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setErrorMsg(null), 3500);
    }
  });

  if (line.availability !== "available") {
    return <span className={styles.unavailable}>Unavailable</span>;
  }

  return (
    <div className={styles.quantityWrapper}>
      <div aria-label={`Quantity: ${line.quantity}`} className={styles.quantity} role="group">
        <button
          aria-label={line.quantity === 1 ? `Remove ${line.productName ?? "item"} from bag` : `Decrease ${line.productName ?? "item"} quantity`}
          className={`${styles.qtyBtn} ${line.quantity === 1 ? styles.qtyTrashBtn : styles.qtyMinusBtn}`}
          disabled={pending}
          onClick={() => (line.quantity === 1 ? mutate(undefined) : mutate(line.quantity - 1))}
          title={line.quantity === 1 ? "Remove from bag" : "Decrease quantity"}
          type="button"
        >
          {line.quantity === 1 ? <TrashIcon size={15} /> : "−"}
        </button>
        <span aria-live="polite" className={styles.qtyValue}>{line.quantity}</span>
        <button
          aria-label={`Increase ${line.productName ?? "item"} quantity`}
          className={`${styles.qtyBtn} ${styles.qtyPlusBtn}`}
          disabled={pending || line.quantity >= 12}
          onClick={() => mutate(line.quantity + 1)}
          title="Increase quantity"
          type="button"
        >
          +
        </button>
      </div>
      {errorMsg ? <span role="alert" className={styles.lineError}>{errorMsg}</span> : null}
    </div>
  );
}

export function CartLineControls({ line }: { line: PublicCartLine }) {
  return <CartLineQuantity line={line} />;
}

function TrashIcon({ size = 18 }: { size?: number }) {
  return (
    <svg aria-hidden="true" fill="none" height={size} viewBox="0 0 24 24" width={size}>
      <path d="M4.5 7h15M9 7V4.5h6V7m-8.5 0 1 13h9l1-13M10 10.5v6m4-6v6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
    </svg>
  );
}


"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { formatMoneyMinor } from "@/lib/money";
import { readGuestCartSnapshotAction, removeGuestCartLineAction, updateGuestCartLineAction } from "@/server/commerce/actions";
import type { PublicCart } from "@/server/commerce/cart-read";
import styles from "./Header.module.css";

export function HeaderCartCount({ initialCount }: { initialCount: number }) {
  const [count, setCount] = useState(initialCount);
  const [cart, setCart] = useState<PublicCart | null>(null);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const update = (event: Event) => {
      const nextCount = (event as CustomEvent<number>).detail;
      setCount(nextCount);
      if (open) startTransition(async () => setCart(await readGuestCartSnapshotAction()));
    };
    window.addEventListener("athar:cart-count", update);
    return () => window.removeEventListener("athar:cart-count", update);
  }, [open]);

  function openCart() {
    setOpen(true);
    startTransition(async () => setCart(await readGuestCartSnapshotAction()));
  }

  function mutateLine(productSlug: string, variantId: string, quantity: number) {
    startTransition(async () => {
      const result = quantity < 1
        ? await removeGuestCartLineAction({ productSlug, variantId })
        : await updateGuestCartLineAction({ productSlug, variantId, quantity });
      if (result.ok) {
        setCount(result.totalQuantity);
        window.dispatchEvent(new CustomEvent("athar:cart-count", { detail: result.totalQuantity }));
        setCart(await readGuestCartSnapshotAction());
      }
    });
  }

  return <>
    <button aria-expanded={open} aria-label={`Shopping bag, ${count} ${count === 1 ? "item" : "items"}`} className={`${styles.action} ${styles.bag}`} onClick={openCart} type="button">
      <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 0 1-8 0" /></svg>
      <span className={styles.badge} aria-hidden="true">{count}</span>
    </button>
    {open ? <div className={styles.cartBackdrop} onClick={() => setOpen(false)} /> : null}
    <aside aria-label="Shopping bag" className={`${styles.cartDrawer} ${styles.cartDrawerBag} ${open ? styles.cartDrawerOpen : ""}`} aria-hidden={!open}>
      <header className={styles.cartDrawerHead}><div><h2>Your bag <span>({cart?.totalQuantity ?? count})</span></h2></div><button aria-label="Close shopping bag" className={styles.cartDrawerClose} onClick={() => setOpen(false)} type="button">×</button></header>
      <div className={styles.cartDrawerBody}>
        {pending && !cart ? <p className={styles.cartDrawerMessage}>Loading your bag…</p> : cart?.lines.length ? cart.lines.map((line) => <div className={styles.cartDrawerLine} key={`${line.productSlug}:${line.variantId}`}>
          {line.media ? <Image alt={line.media.alt} className={styles.cartDrawerImage} height={96} src={line.media.src} width={78} /> : <div className={styles.cartDrawerImagePlaceholder}>ATHAR</div>}
          <div className={styles.cartDrawerLineMain}><strong>{line.productName ?? "Unavailable fragrance"}</strong><span>{line.fragranceType ?? "Fragrance"}</span><span className={styles.cartDrawerSize}>{line.sizeMl ?? "—"} ml</span><div className={styles.cartDrawerControls}><button aria-label="Decrease quantity" disabled={pending} onClick={() => mutateLine(line.productSlug, line.variantId, line.quantity - 1)} type="button">−</button><span>{line.quantity}</span><button aria-label="Increase quantity" disabled={pending || line.quantity >= 12} onClick={() => mutateLine(line.productSlug, line.variantId, line.quantity + 1)} type="button">+</button></div></div><div className={styles.cartDrawerLineAside}><button aria-label="Remove item" className={styles.cartDrawerRemove} disabled={pending} onClick={() => mutateLine(line.productSlug, line.variantId, 0)} type="button">×</button><b>{line.priceMinor !== null ? formatMoneyMinor(line.subtotalMinor ?? line.priceMinor, line.currency ?? "SEK") : "Unavailable"}</b></div>
        </div>) : <div className={styles.cartDrawerEmpty}><p>Your bag is empty</p><Link href="/shop" onClick={() => setOpen(false)}>Continue shopping</Link></div>}
      </div>
      {cart?.lines.length ? <footer className={styles.cartDrawerFoot}><div><span>Total</span><strong>{cart.currency ? formatMoneyMinor(cart.subtotalMinor, cart.currency) : "Unavailable"}</strong></div><Link href="/cart" onClick={() => setOpen(false)}>View bag</Link></footer> : null}
    </aside>
  </>;
}

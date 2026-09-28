"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { addToGuestCartAction, readGuestWishlistSnapshotAction, toggleGuestWishlistAction } from "@/server/commerce/actions";
import type { CatalogProductCard } from "@/server/catalog/read-model";
import { HeartIcon } from "@/components/icons/HeartIcon";
import styles from "./Header.module.css";

const productImages: Record<string, string> = {
  "athar-test-no-01": "/images/catalog/athar-test-no-01-v1.webp",
  "cedar-study": "/images/catalog/cedar-study-v1.webp",
  "no-media-study": "/images/catalog/no-media-study-v1.webp",
  "velvet-sillage": "/images/catalog/velvet-sillage-v1.webp",
  "luminous-fig": "/images/catalog/luminous-fig-v1.webp",
};
type WishlistSnapshot = { availability: "available" | "unavailable"; products: CatalogProductCard[] };

export function HeaderWishlistLink({ initialCount }: { initialCount: number }) {
  const [count, setCount] = useState(initialCount);
  const [wishlist, setWishlist] = useState<WishlistSnapshot | null>(null);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const sync = (event: Event) => {
      const detail = (event as CustomEvent<{ productSlug: string; wishlisted: boolean }>).detail;
      setCount((current) => Math.max(0, current + (detail.wishlisted ? 1 : -1)));
      setWishlist((current) => current ? { ...current, products: detail.wishlisted ? current.products : current.products.filter((product) => product.slug !== detail.productSlug) } : current);
      if (open) startTransition(async () => setWishlist(await readGuestWishlistSnapshotAction()));
    };
    window.addEventListener("athar:wishlist", sync);
    return () => window.removeEventListener("athar:wishlist", sync);
  }, [open]);

  function openWishlist() {
    setOpen(true);
    startTransition(async () => { const next = await readGuestWishlistSnapshotAction(); setWishlist(next); setCount(next.products.length); });
  }

  function remove(slug: string) {
    setCount((current) => Math.max(0, current - 1));
    setWishlist((current) => current ? { ...current, products: current.products.filter((product) => product.slug !== slug) } : current);
    startTransition(async () => { await toggleGuestWishlistAction({ productSlug: slug }); });
  }

  function clearAll() {
    const slugs = wishlist?.products.map((product) => product.slug) ?? [];
    setCount(0);
    setWishlist((current) => current ? { ...current, products: [] } : current);
    startTransition(async () => { await Promise.all(slugs.map((productSlug) => toggleGuestWishlistAction({ productSlug }))); });
  }

  function addToCart(product: CatalogProductCard) {
    const variant = product.variants.find((candidate) => candidate.availability === "available") ?? product.variants[0];
    if (!variant) return;
    startTransition(async () => {
      const result = await addToGuestCartAction({ productSlug: product.slug, variantId: variant.id, quantity: 1 });
      if (result.ok) window.dispatchEvent(new CustomEvent("athar:cart-count", { detail: result.totalQuantity }));
    });
  }

  return <>
    <button aria-expanded={open} aria-label={`Wishlist, ${count} ${count === 1 ? "item" : "items"}`} className={styles.action} onClick={openWishlist} type="button"><HeartIcon /><span className={styles.badge} aria-hidden="true">{count}</span></button>
    {open ? <div className={styles.cartBackdrop} onClick={() => setOpen(false)} /> : null}
    <aside aria-label="Wishlist" className={`${styles.cartDrawer} ${open ? styles.cartDrawerOpen : ""}`} aria-hidden={!open}>
      <header className={styles.cartDrawerHead}><div><h2>Your wishlist <span>({wishlist?.products.length ?? count})</span></h2></div><button aria-label="Close wishlist" className={styles.cartDrawerClose} onClick={() => setOpen(false)} type="button">×</button></header>
      <div className={styles.cartDrawerBody}>
        {pending && !wishlist ? <p className={styles.cartDrawerMessage}>Loading your wishlist…</p> : wishlist?.products.length ? wishlist.products.map((product) => <div className={styles.cartDrawerLine} key={product.slug}>{productImages[product.slug] ? <Link className={styles.cartDrawerImageLink} href={`/products/${product.slug}`} onClick={() => setOpen(false)}><Image alt={product.mediaAlt ?? product.name} className={styles.cartDrawerImage} height={100} src={productImages[product.slug]} width={82} /></Link> : <div className={styles.cartDrawerImagePlaceholder}>ATHAR</div>}<div className={styles.cartDrawerLineMain}><strong>{product.brandName}</strong><span className={styles.wishlistProductName}>{product.name}</span><span className={styles.wishlistType}>{product.fragranceType ?? "Fragrance"}</span><span className={styles.wishlistSize}>{product.variantLabel}</span><div className={styles.wishlistPurchaseRow}><b>{product.priceLabel}</b><button aria-label={`Add ${product.name} to cart`} className={styles.wishlistAddButton} disabled={pending || !product.isAvailable} onClick={() => addToCart(product)} type="button"><svg aria-hidden="true" fill="none" viewBox="0 0 24 24"><path d="M4.5 9.5h15l-1.15 10H5.65L4.5 9.5Z" /><path d="M8.5 9.5V7.25a3.5 3.5 0 0 1 7 0V9.5" /></svg><span>ADD TO CART</span></button></div></div><div className={styles.wishlistLineAside}><button aria-label={`Remove ${product.name} from wishlist`} className={styles.cartDrawerRemove} disabled={pending} onClick={() => remove(product.slug)} type="button">×</button></div></div>) : <div className={styles.cartDrawerEmpty}><p>Your wishlist is empty</p><Link href="/shop" onClick={() => setOpen(false)}>Continue shopping</Link></div>}
      </div>
      {wishlist?.products.length ? <footer className={styles.cartDrawerFoot}><button className={styles.clearWishlist} disabled={pending} onClick={clearAll} type="button">Clear wishlist</button><Link href="/wishlist" onClick={() => setOpen(false)}>View wishlist</Link></footer> : null}
    </aside>
  </>;
}

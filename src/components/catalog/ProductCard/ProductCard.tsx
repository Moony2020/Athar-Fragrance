"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";
import { WishlistButton } from "@/components/commerce/WishlistButton";
import { addToGuestCartAction } from "@/server/commerce/actions";
import type { CatalogProductCard as CatalogProductCardModel } from "@/server/catalog/read-model";
import styles from "./ProductCard.module.css";

type ProductCardProps = { product: CatalogProductCardModel; initialWishlisted?: boolean; priority?: boolean };

const productImages: Record<string, string> = {
  "athar-test-no-01": "/images/catalog/athar-test-no-01-v1.webp",
  "cedar-study": "/images/catalog/cedar-study-v1.webp",
  "no-media-study": "/images/catalog/no-media-study-v1.webp",
  "velvet-sillage": "/images/catalog/velvet-sillage-v1.webp",
  "luminous-fig": "/images/catalog/luminous-fig-v1.webp",
};

/** Established Shop-card presentation; local controls stay separate from persistent commerce. */
export function ProductCard({ product, initialWishlisted = false, priority = false }: ProductCardProps) {
  const [isAdded, setIsAdded] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isImageReady, setImageReady] = useState(false);
  const [selectedSize, setSelectedSize] = useState(() => product.variants.find((variant) => variant.availability === "available")?.sizeMl ?? product.variants[0]?.sizeMl);
  const image = productImages[product.slug] ?? "/images/catalog/product-placeholder.svg";
  const selectedVariant = product.variants.find((variant) => variant.sizeMl === selectedSize) ?? product.variants[0];

  function addToCart() {
    if (!selectedVariant) return;
    startTransition(async () => {
      const result = await addToGuestCartAction({ productSlug: product.slug, variantId: selectedVariant.id, quantity: 1 });
      if (result.ok) {
        setIsAdded(true);
        (window as Window & { __atharCartCount?: number }).__atharCartCount = result.totalQuantity;
        window.dispatchEvent(new CustomEvent("athar:cart-count", { detail: result.totalQuantity }));
      }
    });
  }

  return <article className={styles.card} aria-label={[product.brandName, product.name, product.fragranceType].filter(Boolean).join(" ")}>
    <div className={styles.visual}>
      <Link aria-label={`View ${product.name}`} className={styles.imageLink} href={`/products/${product.slug}`}>
        {!isImageReady ? <span aria-hidden="true" className={styles.imageFallback}><b>ATHAR</b></span> : null}
        <Image alt="" className={styles.productImage} fill loading={priority ? "eager" : "lazy"} onError={() => setImageReady(false)} onLoad={() => setImageReady(true)} sizes="(max-width: 760px) 88vw, (max-width: 1100px) 45vw, 24vw" src={image} />
        {product.badge ? <span className={styles.status}>{product.badge}</span> : !product.isAvailable ? <span className={styles.status}>Not available</span> : null}
      </Link>
      <WishlistButton className={styles.wishlist} initialWishlisted={initialWishlisted} productName={product.name} productSlug={product.slug} />
    </div>
    <div className={styles.infoPanel}>
      <small>{product.brandName}</small>
      <strong className={styles.productName}>{product.name}</strong>
      <span className={styles.concentration}>{product.fragranceType ?? "Eau de Parfum"} · {selectedVariant?.sizeMl ?? product.variants[0]?.sizeMl} ml</span>
      <div aria-label={`Choose ${product.name} size`} className={styles.sizeChoices} role="group">{product.variants.map((variant) => <button aria-pressed={variant.sizeMl === selectedVariant?.sizeMl} className={styles.sizeChoice} disabled={variant.availability !== "available"} key={variant.sizeMl} onClick={() => { setSelectedSize(variant.sizeMl); setIsAdded(false); }} type="button">{variant.sizeMl} ml</button>)}</div>
      <div className={styles.purchaseRow}>
        <strong className={styles.price}>{selectedVariant?.priceLabel ?? product.priceLabel}</strong>
        <button aria-busy={isPending || undefined} aria-label={`Add ${product.name} to cart`} className={styles.addToCart} disabled={isPending || !product.isAvailable || selectedVariant?.availability !== "available"} onClick={addToCart} type="button"><BagIcon added={isAdded} /><span>{isPending ? "ADDING" : isAdded ? "ADDED" : "ADD TO CART"}</span></button>
      </div>
    </div>
  </article>;
}

function BagIcon({ added }: { added: boolean }) { return <svg aria-hidden="true" fill="none" viewBox="0 0 24 24"><path d="M4.5 9.5h15l-1.15 10H5.65L4.5 9.5Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /><path d="M8.5 9.5V7.25a3.5 3.5 0 0 1 7 0V9.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />{added ? <path d="m9.15 14 1.85 1.85 3.9-4.1" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /> : null}</svg>; }

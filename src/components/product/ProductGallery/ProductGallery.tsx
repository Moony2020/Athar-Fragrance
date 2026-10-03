"use client";

import Image from "next/image";
import { useState } from "react";
import { WishlistButton } from "@/components/commerce/WishlistButton";
import { getCustomerProductImageSource } from "@/lib/customer-product-image";
import type { CatalogProductDetail } from "@/server/catalog/read-model";
import styles from "./ProductGallery.module.css";

type PublicMedia = CatalogProductDetail["media"][number];
const placeholderSrc = "/images/catalog/product-placeholder.svg";

/**
 * The PDP stays server-rendered. This smallest client island owns only the
 * presentational selected-media index for Products with multiple images.
 */
export function ProductGallery({ media, productName, productSlug, initialWishlisted }: { media: PublicMedia[]; productName: string; productSlug: string; initialWishlisted: boolean }) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selected = media[selectedIndex] ?? null;

  if (!selected) {
    return (
      <section className={styles.gallery} aria-label="Product media">
        <div className={styles.placeholder} role="img" aria-label={`${productName} media placeholder`}>
          <Image src={getCustomerProductImageSource(productSlug) ?? placeholderSrc} alt="" fill priority sizes="(max-width: 760px) 100vw, 28rem" />
        </div>
      </section>
    );
  }

  return (
    <section className={styles.gallery} aria-label="Product media">
      {media.length > 1 ? (
        <div className={styles.thumbnailRail} aria-label="Choose product media" role="group">
          {media.map((item, index) => {
            const isSelected = index === selectedIndex;
            return (
              <button
                aria-label={`Show product media ${index + 1}: ${item.alt}`}
                aria-pressed={isSelected}
                className={styles.thumbnail}
                key={`${item.position}-${item.url}`}
                onClick={() => setSelectedIndex(index)}
                type="button"
              >
                <span aria-hidden="true" className={`${styles.thumbnailImage} ${toneClass(item.position)}`}>
                  <GalleryImage media={item} productSlug={productSlug} />
                </span>
                <span className={styles.thumbnailLabel}>{`Media ${index + 1}${isSelected ? ", selected" : ""}`}</span>
              </button>
            );
          })}
        </div>
      ) : null}
      <div className={`${styles.primary} ${toneClass(selected.position)}`} aria-live="polite">
        <GalleryImage media={selected} priority={selectedIndex === 0} productSlug={productSlug} />
        <WishlistButton className={styles.primaryWishlist} initialWishlisted={initialWishlisted} productName={productName} productSlug={productSlug} />
      </div>
    </section>
  );
}



function GalleryImage({ media, priority = false, productSlug }: { media: PublicMedia; priority?: boolean; productSlug: string }) {
  // Product visuals are project-local ATHAR assets. Remote canonical media stays
  // data-only until its provider/domain is owner-approved.
  return <Image src={getCustomerProductImageSource(productSlug) ?? placeholderSrc} alt={media.alt} fill priority={priority} sizes="(max-width: 760px) 100vw, 28rem" />;
}

function toneClass(position: number) {
  return position % 3 === 1 ? styles.toneOne : position % 3 === 2 ? styles.toneTwo : styles.toneZero;
}

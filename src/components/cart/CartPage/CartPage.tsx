"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/Button/Button";
import { formatMoneyMinor } from "@/lib/money";
import type { PublicCart } from "@/server/commerce/cart-read";
import { CartLineQuantity, CartLineRemoveButton } from "./CartLineControls";
import styles from "./CartPage.module.css";

export function CartPage({ cart }: { cart: PublicCart }) {
  const availableKeys = cart.lines
    .filter((line) => line.availability === "available")
    .map((line) => `${line.productSlug}:${line.variantId}`);
  const availableSignature = availableKeys.join("|");
  const previousAvailableSignature = useRef(availableSignature);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => {
    return new Set(availableKeys);
  });

  useEffect(() => {
    if (previousAvailableSignature.current === availableSignature) return;
    const previousKeys = new Set(previousAvailableSignature.current.split("|").filter(Boolean));
    const currentKeys = new Set(availableKeys);
    setSelectedKeys((selected) => {
      const next = new Set([...selected].filter((key) => currentKeys.has(key)));
      for (const key of availableKeys) {
        if (!previousKeys.has(key)) next.add(key);
      }
      return next;
    });
    previousAvailableSignature.current = availableSignature;
  }, [availableSignature]);

  if (cart.availability === "unavailable") {
    return (
      <section className={styles.page} aria-labelledby="cart-title">
        <h1 id="cart-title">Your bag</h1>
        <p role="status">Bag details are temporarily unavailable.</p>
      </section>
    );
  }
  if (cart.lines.length === 0) {
    return (
      <section className={styles.empty} aria-labelledby="cart-title">
        <h1 id="cart-title">Your bag is empty</h1>
        <p>Discover a fragrance to make it yours.</p>
        <Button className={styles.explore} href="/shop">
          Explore fragrances <span aria-hidden="true">↗</span>
        </Button>
      </section>
    );
  }

  const availableLines = cart.lines.filter((l) => l.availability === "available");
  const isAllSelected =
    availableLines.length > 0 && availableLines.every((l) => selectedKeys.has(`${l.productSlug}:${l.variantId}`));

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedKeys(new Set());
    } else {
      setSelectedKeys(new Set(availableLines.map((l) => `${l.productSlug}:${l.variantId}`)));
    }
  };

  const toggleItem = (lineKey: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(lineKey)) {
        next.delete(lineKey);
      } else {
        next.add(lineKey);
      }
      return next;
    });
  };

  const selectedLines = cart.lines.filter(
    (line) => line.availability === "available" && selectedKeys.has(`${line.productSlug}:${line.variantId}`)
  );
  const selectedSubtotalMinor = selectedLines.reduce((acc, line) => acc + (line.subtotalMinor ?? 0), 0);
  const selectedTotalQuantity = selectedLines.reduce((acc, line) => acc + line.quantity, 0);

  return (
    <section className={styles.page} aria-labelledby="cart-title">
      <nav aria-label="Breadcrumb" className={styles.breadcrumb}>
        <Link href="/shop">Shop</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">Your bag</span>
      </nav>
      <header className={styles.heading}>
        <div>
          <h1 id="cart-title">Your bag</h1>
        </div>
        <span>
          {cart.totalQuantity} {cart.totalQuantity === 1 ? "item" : "items"}
        </span>
      </header>
      <div className={styles.layout}>
        <div>
          <div className={styles.listHeader}>
            <button
              aria-label={isAllSelected ? "Deselect all items" : "Select all items"}
              className={styles.selectAllBtn}
              onClick={toggleSelectAll}
              type="button"
            >
              <span className={`${styles.checkCircle} ${isAllSelected ? styles.checked : ""}`}>
                {isAllSelected && (
                  <svg aria-hidden="true" fill="none" height="11" viewBox="0 0 24 24" width="11">
                    <path d="M4 12.5l5.5 5.5L20 6.5" stroke="#fff" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.8" />
                  </svg>
                )}
              </span>
              <span>Selected fragrances ({selectedLines.length}/{availableLines.length})</span>
            </button>
            <Link href="/shop">
              Continue shopping <span aria-hidden="true">↗</span>
            </Link>
          </div>
          <div className={styles.lines} aria-label="Bag items" role="list">
            {cart.lines.map((line, lineIndex) => {
              const lineKey = `${line.productSlug}:${line.variantId}`;
              const isSelected = selectedKeys.has(lineKey);
              const isAvailable = line.availability === "available";

              return (
                <div
                  className={styles.line}
                  data-availability={line.availability}
                  data-selected={isSelected}
                  key={lineKey}
                  role="listitem"
                >
                  <button
                    aria-checked={isSelected}
                    aria-label={`Select ${line.productName ?? "fragrance"}`}
                    className={styles.selectBtn}
                    disabled={!isAvailable}
                    onClick={() => toggleItem(lineKey)}
                    role="checkbox"
                    type="button"
                  >
                    <span className={`${styles.checkCircle} ${isSelected ? styles.checked : ""}`}>
                      {isSelected && (
                        <svg aria-hidden="true" fill="none" height="11" viewBox="0 0 24 24" width="11">
                          <path d="M4 12.5l5.5 5.5L20 6.5" stroke="#fff" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.8" />
                        </svg>
                      )}
                    </span>
                  </button>

                  {line.media ? (
                    <Link
                      aria-label={`View ${line.productName ?? "fragrance"}`}
                      className={styles.media}
                      href={`/products/${line.productSlug}`}
                    >
                      <Image
                        alt={line.media.alt}
                        fill
                        loading={lineIndex === 0 ? "eager" : "lazy"}
                        sizes="(max-width: 680px) 5.5rem, 7.5rem"
                        src={line.media.src}
                      />
                    </Link>
                  ) : (
                    <div
                      aria-label="Product media unavailable"
                      className={styles.placeholder}
                      role="img"
                    >
                      ATHAR
                    </div>
                  )}
                  <div className={styles.detail}>
                    <div className={styles.detailTop}>
                      <div className={styles.meta}>
                        {line.brandName ? <p className={styles.brand}>{line.brandName}</p> : null}
                        {line.productName ? (
                          <Link href={`/products/${line.productSlug}`} className={styles.productTitle}>
                            <h2>{line.productName}</h2>
                          </Link>
                        ) : (
                          <h2>Unavailable fragrance</h2>
                        )}
                        <span className={styles.specs}>
                          {[
                            line.fragranceType,
                            line.sizeMl ? `${line.sizeMl} ml` : "Size unavailable",
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </div>
                      <CartLineRemoveButton line={line} />
                    </div>

                    <div className={styles.detailBottom}>
                      <div className={styles.priceContainer}>
                        {line.availability === "available" && line.priceMinor !== null ? (
                          <strong className={styles.price}>
                            {formatMoneyMinor(line.priceMinor, line.currency ?? "SEK")}
                          </strong>
                        ) : (
                          <small role="status">This item is currently unavailable and is excluded from subtotal.</small>
                        )}
                      </div>
                      <CartLineQuantity line={line} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <aside aria-label="Order summary" className={styles.summary} role="region">
          <p className={styles.summaryKicker}>
            Order summary · {selectedTotalQuantity} {selectedTotalQuantity === 1 ? "item" : "items"}
          </p>
          <div>
            <span>Subtotal</span>
            <strong>
              {cart.currency ? formatMoneyMinor(selectedSubtotalMinor, cart.currency) : "Unavailable"}
            </strong>
          </div>
          <div>
            <span>Delivery</span>
            <em>Calculated later</em>
          </div>
          <div className={styles.summaryTotal}>
            <span>Total</span>
            <strong>
              {cart.currency ? formatMoneyMinor(selectedSubtotalMinor, cart.currency) : "Unavailable"}
            </strong>
          </div>
          {selectedTotalQuantity > 0 ? (
            <Link className={styles.checkout} href="/checkout">
              Proceed to checkout <span aria-hidden="true">↗</span>
            </Link>
          ) : (
            <button className={`${styles.checkout} ${styles.checkoutDisabled}`} disabled type="button">
              Select items to checkout
            </button>
          )}
          <small>Prices are current. Delivery, tax, and payment are not calculated in the bag.</small>
          <ul className={styles.assurances}>
            <li>Current catalog prices</li>
            <li>Complementary delivery may apply</li>
          </ul>
        </aside>
      </div>
    </section>
  );
}

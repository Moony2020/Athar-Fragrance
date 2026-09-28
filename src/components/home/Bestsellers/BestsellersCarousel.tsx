"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { FeaturedFragrance } from "./Bestsellers";
import styles from "./Bestsellers.module.css";

type BestsellersCarouselProps = {
  fragrances: readonly FeaturedFragrance[];
};

export function BestsellersCarousel({ fragrances }: BestsellersCarouselProps) {
  const trackRef = useRef<HTMLUListElement>(null);
  const [canScrollBack, setCanScrollBack] = useState(false);
  const [canScrollForward, setCanScrollForward] = useState(false);

  const updateScrollState = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;

    setCanScrollBack(track.scrollLeft > 1);
    setCanScrollForward(track.scrollLeft + track.clientWidth < track.scrollWidth - 1);
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    updateScrollState();
    const observer = new ResizeObserver(updateScrollState);
    observer.observe(track);
    track.addEventListener("scroll", updateScrollState, { passive: true });

    return () => {
      observer.disconnect();
      track.removeEventListener("scroll", updateScrollState);
    };
  }, [updateScrollState, fragrances.length]);

  function scroll(direction: -1 | 1) {
    const track = trackRef.current;
    if (!track) return;

    track.scrollBy({ left: direction * track.clientWidth * 0.82, behavior: "smooth" });
  }

  return (
    <>
      <div className={styles.carouselToolbar}>
        <Link className={styles.exploreAll} href="/shop">
          Explore fragrances <span aria-hidden="true">→</span>
        </Link>
      </div>

      <div className={styles.carouselStage}>
        {canScrollBack && (
          <button
            aria-label="Scroll fragrances left"
            className={`${styles.carouselButton} ${styles.carouselButtonLeft}`}
            onClick={() => scroll(-1)}
            type="button"
          >
            <span aria-hidden="true">←</span>
          </button>
        )}
        <ul className={styles.productGrid} aria-label="Selected fragrance references" ref={trackRef}>
          {fragrances.map((fragrance) => (
            <li className={styles.productItem} key={fragrance.name}>
              <article className={styles.productCard}>
                <div className={styles.productVisual}>
                  <Image
                    alt={`${fragrance.brand} ${fragrance.name} ${fragrance.concentration}, ${fragrance.size}`}
                    className={styles.productImage}
                    fill
                    sizes="(max-width: 600px) 72vw, (max-width: 1000px) 32vw, 25vw"
                    src={fragrance.image}
                    unoptimized
                  />
                </div>
                <div className={styles.productDetails}>
                  <p className={styles.brand}>{fragrance.brand}</p>
                  <h3>{fragrance.name}</h3>
                  <p className={styles.concentration}>{fragrance.concentration} · {fragrance.size}</p>
                </div>
              </article>
            </li>
          ))}
        </ul>
        {canScrollForward && (
          <button
            aria-label="Scroll fragrances right"
            className={`${styles.carouselButton} ${styles.carouselButtonRight}`}
            onClick={() => scroll(1)}
            type="button"
          >
            <span aria-hidden="true">→</span>
          </button>
        )}
      </div>
    </>
  );
}

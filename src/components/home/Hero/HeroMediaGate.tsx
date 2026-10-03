"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { AtharLoadingPresentation } from "@/components/layout/AtharLoadingPresentation";
import styles from "./HeroMediaGate.module.css";

export function HeroMediaGate({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const images = Array.from(rootRef.current?.querySelectorAll<HTMLImageElement>("img[data-hero-required]") ?? []);
    if (!images.length) {
      setIsReady(true);
      return;
    }

    const unresolved = new Set(images);
    const settle = (image: HTMLImageElement) => {
      unresolved.delete(image);
      if (!unresolved.size) setIsReady(true);
    };
    const listeners = images.map((image) => {
      const complete = () => settle(image);
      if (image.complete) {
        complete();
        return { image, complete };
      }
      image.addEventListener("load", complete, { once: true });
      image.addEventListener("error", complete, { once: true });
      return { image, complete };
    });

    return () => listeners.forEach(({ image, complete }) => {
      image.removeEventListener("load", complete);
      image.removeEventListener("error", complete);
    });
  }, []);

  return <div className={styles.gate} ref={rootRef} aria-busy={!isReady}>
    <div className={isReady ? styles.ready : styles.pending}>{children}</div>
    {!isReady ? <AtharLoadingPresentation overlay /> : null}
  </div>;
}

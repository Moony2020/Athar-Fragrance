"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleGuestWishlistAction } from "@/server/commerce/actions";
import { HeartIcon } from "@/components/icons/HeartIcon";

type WishlistButtonProps = {
  productSlug: string;
  productName: string;
  className: string;
  initialWishlisted?: boolean;
};

export function WishlistButton({ productSlug, productName, className, initialWishlisted = false }: WishlistButtonProps) {
  const router = useRouter();
  const [saved, setSaved] = useState(initialWishlisted);
  const [pending, start] = useTransition();

  useEffect(() => {
    const sync = (event: Event) => {
      const detail = (event as CustomEvent<{ productSlug: string; wishlisted: boolean }>).detail;
      if (detail.productSlug === productSlug) setSaved(detail.wishlisted);
    };
    window.addEventListener("athar:wishlist", sync);
    return () => window.removeEventListener("athar:wishlist", sync);
  }, [productSlug]);

  const toggle = () => start(async () => {
    const result = await toggleGuestWishlistAction({ productSlug });
    if (!result.ok) return;
    setSaved(result.wishlisted);
    window.dispatchEvent(new CustomEvent("athar:wishlist", { detail: { productSlug, wishlisted: result.wishlisted } }));
    if (!result.wishlisted) router.refresh();
  });

  return (
    <button
      aria-label={`${saved ? "Remove" : "Add"} ${productName} ${saved ? "from" : "to"} wishlist`}
      aria-pressed={saved}
      aria-busy={pending || undefined}
      className={className}
      disabled={pending}
      onClick={toggle}
      type="button"
    >
      <HeartIcon filled={saved} />
    </button>
  );
}

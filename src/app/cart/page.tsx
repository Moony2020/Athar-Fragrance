import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { CartPage } from "@/components/cart/CartPage/CartPage";
import { CatalogShell } from "@/components/catalog/CatalogShell/CatalogShell";
import { Container } from "@/components/ui/Container/Container";
import { readCurrentCommerceCart } from "@/server/commerce/cart-read";
import styles from "./page.module.css";

export const metadata: Metadata = { title: "Your bag | ATHAR", robots: { index: false, follow: false } };

export default function CartRoute() {
  return <CatalogShell><Container><Suspense fallback={<CartLoadingState />}><CartContents /></Suspense></Container></CatalogShell>;
}

function CartLoadingState() {
  return <section aria-busy="true" aria-label="Loading your bag" className={styles.loading} role="status">
    <span className={styles.loadingIndicator}>Loading your bag…</span>
  </section>;
}

async function CartContents() {
  await connection();
  return <CartPage cart={await readCurrentCommerceCart()} />;
}

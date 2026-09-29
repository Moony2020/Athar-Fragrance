import type { Metadata } from "next";
import { BrandGrid } from "@/components/catalog/BrandGrid/BrandGrid";
import { CatalogShell } from "@/components/catalog/CatalogShell/CatalogShell";
import { Container } from "@/components/ui/Container/Container";
import { getBrandIndexData } from "@/server/catalog/services";
import styles from "@/components/catalog/BrandPage/BrandPage.module.css";

export const metadata: Metadata = {
  title: "Brands | ATHAR",
  description: "Browse fragrance brands in the ATHAR catalog.",
};

export const instant = false;

export default async function BrandsPage() {
  const browse = await getBrandIndexData();
  return (
    <CatalogShell>
      <section className={styles.page} aria-labelledby="brands-title">
        <Container>
          <header className={styles.header}>
            <p className={styles.eyebrow}>Discover</p>
            <h1 id="brands-title">Brands at ATHAR</h1>
            <p className={styles.description}>Explore the fragrance houses currently represented in the catalog.</p>
          </header>
          <BrandGrid availability={browse.availability} brands={browse.brands} />
        </Container>
      </section>
    </CatalogShell>
  );
}

import type { CatalogProductCard } from "@/server/catalog/read-model";
import { ProductCard } from "@/components/catalog/ProductCard/ProductCard";
import styles from "./CatalogGrid.module.css";

type CatalogGridProps = {
  availability: "available" | "unavailable";
  emptyMessage: string;
  products: CatalogProductCard[];
};

export function CatalogGrid({ availability, emptyMessage, products }: CatalogGridProps) {
  if (availability === "unavailable") {
    return <p className={styles.empty} role="status">Catalog browsing is temporarily unavailable.</p>;
  }

  if (products.length === 0) {
    return <p className={styles.empty} role="status">{emptyMessage}</p>;
  }

  return (
    <ul className={styles.grid} aria-label="Catalog products">
      {products.map((product, index) => <li key={product.slug}><ProductCard priority={index === 0} product={product} /></li>)}
    </ul>
  );
}

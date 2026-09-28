import Image from "next/image";
import Link from "next/link";
import { CatalogGrid } from "@/components/catalog/CatalogGrid/CatalogGrid";
import { CatalogDiscovery } from "@/components/catalog/CatalogDiscovery/CatalogDiscovery";
import { CatalogShell } from "@/components/catalog/CatalogShell/CatalogShell";
import { Container } from "@/components/ui/Container/Container";
import { hasUnscopedDiscoveryQuery, type CatalogBrowseResult, type CatalogDiscoveryResult } from "@/server/catalog/services";
import styles from "./CatalogPage.module.css";

type CatalogPageProps = {
  browse: CatalogBrowseResult;
  eyebrow: string;
  title: string;
  description: string;
  emptyMessage: string;
  showAudienceNavigation?: boolean;
  showCollections?: boolean;
  discovery?: CatalogDiscoveryResult;
  discoveryAction?: string;
};

const audiences = [
  { href: "/shop", label: "All Fragrances", shortLabel: "All" },
  { href: "/shop/women", label: "For Her", shortLabel: "For Her" },
  { href: "/shop/men", label: "For Him", shortLabel: "For Him" },
  { href: "/shop/unisex", label: "Unisex", shortLabel: "Unisex" },
];

export function CatalogPage({ browse, eyebrow, title, description, emptyMessage, showAudienceNavigation = true, showCollections = false, discovery, discoveryAction = "/shop" }: CatalogPageProps) {
  const isShopTitle = title === "Shop Fragrances";

  return (
    <CatalogShell>
      <section className={styles.page} aria-labelledby="catalog-title">
        <div className={styles.heroSection}>
          <div className={styles.heroBackgroundWrap}>
            <Image
              alt=""
              className={styles.heroBackground}
              fill
              priority
              unoptimized
              src="/images/catalog/shophero.webp"
            />
            <div className={styles.heroWash} aria-hidden="true" />
          </div>

          <Container className={styles.heroContainer}>
            <header className={styles.header}>
              <div className={styles.headerCopy}>
                <p className={styles.eyebrow}>{eyebrow}</p>
                <h1 id="catalog-title" className={styles.title}>
                  {isShopTitle ? (
                    <>
                      <span className={styles.titleLine}>Shop</span>
                      <span className={styles.titleLine}>Fragrances</span>
                    </>
                  ) : (
                    title
                  )}
                </h1>
                <p className={styles.description}>{description}</p>
              </div>
            </header>
          </Container>
        </div>

        <Container>
          {showAudienceNavigation && (
            <nav className={styles.audienceNav} aria-label="Browse by audience">
              {audiences.map((audience) => {
                const isActive = audience.href === discoveryAction;
                return (
                  <Link
                    href={audience.href}
                    key={audience.href}
                    className={`${styles.audiencePill} ${isActive ? styles.audiencePillActive : ""}`}
                  >
                    <span className={styles.desktopPillLabel}>{audience.label}</span>
                    <span className={styles.mobilePillLabel}>{audience.shortLabel}</span>
                  </Link>
                );
              })}
            </nav>
          )}

          {showCollections && browse.availability === "available" && browse.collections.length > 0 && (
            <nav className={styles.collectionNav} aria-label="Browse collections">
              {browse.collections.map((collection) => <Link href={`/collections/${collection.slug}`} key={collection.slug}>{collection.name}</Link>)}
            </nav>
          )}

          {discovery && discovery.availability === "available" && <CatalogDiscovery action={discoveryAction} options={discovery.options} query={discovery.query} resultCount={discovery.products.length} scope={discovery.scope} />}
          <CatalogGrid availability={browse.availability} emptyMessage={discovery && hasUnscopedDiscoveryQuery(discovery.query, discovery.scope) && discovery.products.length === 0 && discovery.availability === "available" ? "No fragrances match these filters." : emptyMessage} products={browse.products} />
        </Container>
      </section>
    </CatalogShell>
  );
}

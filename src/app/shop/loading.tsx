import styles from "./loading.module.css";

export default function ShopLoading() {
  return (
    <div className={styles.shopLoading} aria-label="Loading fragrance catalog" role="status">
      {/* Header Skeleton */}
      <div className={styles.headerSkeleton}>
        <div className={`${styles.eyebrowSkeleton} ${styles.shimmer}`} />
        <div className={`${styles.titleSkeleton} ${styles.shimmer}`} />
        <div className={`${styles.descSkeleton} ${styles.shimmer}`} />
      </div>

      {/* Categories Skeleton */}
      <div className={styles.pillsSkeleton}>
        <div className={`${styles.pillSkeletonActive} ${styles.shimmer}`} />
        <div className={`${styles.pillSkeleton} ${styles.shimmer}`} />
        <div className={`${styles.pillSkeleton} ${styles.shimmer}`} />
        <div className={`${styles.pillSkeleton} ${styles.shimmer}`} />
      </div>

      {/* Toolbar Skeleton */}
      <div className={styles.toolbarSkeleton}>
        <div className={`${styles.searchSkeleton} ${styles.shimmer}`} />
        <div className={`${styles.filterBtnSkeleton} ${styles.shimmer}`} />
      </div>

      {/* Cards Grid Skeleton */}
      <div className={styles.gridSkeleton}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className={styles.cardSkeleton}>
            <div className={`${styles.imageSkeleton} ${styles.shimmer}`}>
              <div className={styles.bottleSilhouette} />
            </div>
            <div className={styles.cardBodySkeleton}>
              <div className={`${styles.cardBrandSkeleton} ${styles.shimmer}`} />
              <div className={`${styles.cardNameSkeleton} ${styles.shimmer}`} />
              <div className={`${styles.cardPriceSkeleton} ${styles.shimmer}`} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

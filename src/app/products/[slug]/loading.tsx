import styles from "@/app/shop/loading.module.css";

export default function ProductDetailLoading() {
  return (
    <div
      style={{
        maxWidth: "var(--layout-max-width, 83.75rem)",
        margin: "0 auto",
        padding: "clamp(2rem, 5vw, 4rem) var(--layout-gutter, 1.5rem)",
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
        gap: "3rem",
        minHeight: "70vh",
        alignItems: "center",
      }}
      aria-label="Loading fragrance details"
      role="status"
    >
      {/* Product Image Skeleton */}
      <div
        className={styles.shimmer}
        style={{
          width: "100%",
          aspectRatio: "4 / 5",
          borderRadius: "1.5rem",
          background: "linear-gradient(135deg, rgba(242, 230, 214, 0.6) 0%, rgba(223, 202, 157, 0.2) 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: "1px solid rgba(141, 116, 61, 0.15)",
        }}
      >
        <div className={styles.bottleSilhouette} style={{ width: "70px", height: "120px" }} />
      </div>

      {/* Product Info Skeleton */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        <div className={`${styles.eyebrowSkeleton} ${styles.shimmer}`} style={{ width: "6rem", height: "1rem" }} />
        <div className={`${styles.titleSkeleton} ${styles.shimmer}`} style={{ width: "80%", height: "3rem" }} />
        <div className={`${styles.cardPriceSkeleton} ${styles.shimmer}`} style={{ width: "5rem", height: "1.5rem" }} />
        <div className={`${styles.descSkeleton} ${styles.shimmer}`} style={{ width: "100%", height: "4rem", borderRadius: "0.5rem" }} />
        
        {/* Purchase button skeleton */}
        <div
          className={styles.shimmer}
          style={{
            marginTop: "1.5rem",
            width: "100%",
            maxWidth: "320px",
            height: "3.5rem",
            borderRadius: "999px",
            background: "rgba(23, 21, 18, 0.1)",
          }}
        />
      </div>
    </div>
  );
}

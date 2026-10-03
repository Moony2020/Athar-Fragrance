import styles from "@/app/loading.module.css";

export function AtharLoadingPresentation({ overlay = false }: { overlay?: boolean }) {
  return (
    <div className={`${styles.container} ${overlay ? styles.overlay : ""}`} aria-label="Loading ATHAR Haute Parfumerie" role="status">
      <div className={styles.ambientGlow} aria-hidden="true" />
      <div className={styles.emblemWrapper} aria-hidden="true">
        <div className={styles.ringOne} />
        <div className={styles.ringTwo} />
        <div className={styles.iconCircle}>
          <svg className={styles.perfumeIcon} viewBox="0 0 24 24" stroke="currentColor" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M10 2h4v3h-4z" /><path d="M12 5v3" /><rect x="6" y="8" width="12" height="13" rx="3" /><path d="M9 13h6" /><path d="M12 11v4" />
          </svg>
        </div>
      </div>
      <div className={styles.brandInfo}>
        <h1 className={styles.brandTitle}>ATHAR</h1>
        <p className={styles.brandSubtitle}>Haute Parfumerie</p>
        <div className={styles.loadingTrack} aria-hidden="true"><div className={styles.loadingBar} /></div>
        <span className={styles.statusText}>Awakening the senses…</span>
      </div>
    </div>
  );
}

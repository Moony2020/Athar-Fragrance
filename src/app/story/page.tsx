import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/ui/Container/Container";
import { Header } from "@/components/layout/Header/Header";
import { Footer } from "@/components/layout/Footer/Footer";
import styles from "./StoryPage.module.css";

export const metadata: Metadata = {
  title: "The Story of ATHAR | Haute Parfumerie Heritage & Philosophy",
  description:
    "Discover the philosophy, noble ingredients, artisan craftsmanship, and olfactory heritage behind the House of ATHAR. More than a perfume, it's a feeling.",
};

export default function StoryPage() {
  return (
    <>
      <Header />
      <main className={styles.main}>
        {/* ===================================================================
            HERO: Grand Editorial Opening
            =================================================================== */}
        <section className={styles.heroSection}>
          <div className={styles.heroAmbientGlow} aria-hidden="true" />
          <Container>
            <div className={styles.heroContent}>
              <span className={styles.heroEyebrow}>Haute Parfumerie Heritage</span>
              <h1 className={styles.heroTitle}>
                The Art of Olfactory Poetry
              </h1>
              <p className={styles.heroSubtitle}>
                Born from an obsessive pursuit of rare botanicals, ancient alchemy,
                and timeless emotions. At ATHAR, fragrance is an intimate narrative
                — an invisible signature that lingers as a testament to your moments.
              </p>
              <div className={styles.heroSeal}>
                <span className={styles.sealLine} />
                <span className={styles.sealMonogram}>ATHAR · EST. 2024</span>
                <span className={styles.sealLine} />
              </div>
            </div>
          </Container>
        </section>

        {/* ===================================================================
            CHAPTER 1: The Origin & The Philosophy
            =================================================================== */}
        <section className={styles.chapterSection}>
          <Container>
            <div className={styles.editorialGrid}>
              <div className={styles.portraitCol}>
                <div className={styles.portraitFrame}>
                  <Image
                    src="/images/home/story-woman.jpg"
                    alt="Radiant woman gently experiencing jasmine essence"
                    fill
                    className={styles.portraitImg}
                    sizes="(max-width: 768px) 90vw, 540px"
                    priority
                  />
                  <div className={styles.frameGoldBorder} aria-hidden="true" />
                </div>
                <div className={styles.quoteCard}>
                  <span className={styles.quoteSymbol} aria-hidden="true">“</span>
                  <blockquote className={styles.quoteBody}>
                    A fragrance is the most intense form of memory — an invisible presence that speaks when words cannot.
                  </blockquote>
                </div>
              </div>

              <div className={styles.narrativeCol}>
                <span className={styles.chapterLabel}>Chapter I · The Genesis</span>
                <h2 className={styles.chapterHeading}>Where Scent Becomes Memory</h2>
                <div className={styles.decorativeDivider} />
                <p className={styles.narrativeText}>
                  ATHAR was founded on a singular conviction: that a fragrance should
                  never be a commercial afterthought or a superficial accessory.
                  True perfumery is sensory storytelling — the alchemy of capturing
                  a fleeting emotion, a memory of rain on warm stone, or the intoxicating
                  allure of dusk over a desert horizon.
                </p>
                <p className={styles.narrativeText}>
                  We bridge the regal traditions of Eastern amber and precious ouds
                  with the effortless sophistication of Parisian high perfumery. Every
                  formula is composed with patience, allowed to macerate for months until
                  every facet reaches transcendent harmony.
                </p>
                <div className={styles.statsRow}>
                  <div className={styles.statItem}>
                    <span className={styles.statNum}>100%</span>
                    <span className={styles.statLabel}>Authentic Extrait &amp; EdP</span>
                  </div>
                  <div className={styles.statItem}>
                    <span className={styles.statNum}>6+</span>
                    <span className={styles.statLabel}>Months Aging &amp; Maceration</span>
                  </div>
                  <div className={styles.statItem}>
                    <span className={styles.statNum}>Zero</span>
                    <span className={styles.statLabel}>Compromise on Purity</span>
                  </div>
                </div>
              </div>
            </div>
          </Container>
        </section>

        {/* ===================================================================
            CHAPTER 2: Noble Ingredients Showcase
            =================================================================== */}
        <section className={styles.botanicalsSection}>
          <Container>
            <div className={styles.sectionHeader}>
              <span className={styles.chapterLabel}>Chapter II · The Palette</span>
              <h2 className={styles.chapterHeadingCenter}>Noble Ingredients of the World</h2>
              <p className={styles.sectionSubtext}>
                We traverse continents to source the rarest, ethically harvested
                botanicals, precious resins, and pure essences.
              </p>
            </div>

            <div className={styles.botanicalGrid}>
              <article className={styles.botanicalCard}>
                <div className={styles.botanicalIcon}>
                  <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 2C6.5 2 2 6.5 2 12c0 3.5 2 6.5 5 8 .5-4.5 3-8 8-10M12 2c3.5 3 5 7 5 11 0 4-3 7-7 8M12 2c1 5 0 9-3 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
                <h3 className={styles.botanicalTitle}>Grasse Jasmine &amp; Damascena</h3>
                <span className={styles.botanicalOrigin}>Provence &amp; Valley of the Roses</span>
                <p className={styles.botanicalDesc}>
                  Hand-harvested at the first light of dawn when petal oils reach their peak concentration, releasing a velvety, luminous floral heart.
                </p>
              </article>

              <article className={styles.botanicalCard}>
                <div className={styles.botanicalIcon}>
                  <svg aria-hidden="true" viewBox="0 0 24 24"><polygon points="12 2 21 8.5 17 21 7 21 3 8.5 12 2" fill="none" stroke="currentColor" strokeWidth="1.6"/><line x1="3" y1="8.5" x2="21" y2="8.5" stroke="currentColor" strokeWidth="1.6"/><polyline points="12 2 17 8.5 12 21 7 8.5 12 2" fill="none" stroke="currentColor" strokeWidth="1.6"/></svg>
                </div>
                <h3 className={styles.botanicalTitle}>Golden Ambergris &amp; Rare Ouds</h3>
                <span className={styles.botanicalOrigin}>Arabian Peninsula &amp; Assam</span>
                <p className={styles.botanicalDesc}>
                  Aged resinous woods and golden amber that impart unprecedented longevity, melting intimately into skin chemistry with warm magnetic warmth.
                </p>
              </article>

              <article className={styles.botanicalCard}>
                <div className={styles.botanicalIcon}>
                  <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1.6"/><path d="M12 2a14.5 14.5 0 0 0 0 20M12 2a14.5 14.5 0 0 1 0 20M2 12h20" fill="none" stroke="currentColor" strokeWidth="1.6"/></svg>
                </div>
                <h3 className={styles.botanicalTitle}>Calabrian Bergamot</h3>
                <span className={styles.botanicalOrigin}>Southern Italy</span>
                <p className={styles.botanicalDesc}>
                  Cold-pressed sunlit zest offering radiant sparkle, invigorating crispness, and a captivating contrast against rich balsamic foundations.
                </p>
              </article>

              <article className={styles.botanicalCard}>
                <div className={styles.botanicalIcon}>
                  <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" fill="none" stroke="currentColor" strokeWidth="1.6"/></svg>
                </div>
                <h3 className={styles.botanicalTitle}>Florentine Orris &amp; Mysore Santal</h3>
                <span className={styles.botanicalOrigin}>Tuscany &amp; Karnataka</span>
                <p className={styles.botanicalDesc}>
                  Cured iris rhizomes and creamy sandalwood aged three years to produce a powdery, silken trail of pure understated luxury.
                </p>
              </article>
            </div>
          </Container>
        </section>

        {/* ===================================================================
            CHAPTER 3: The Flacon & Craftsmanship
            =================================================================== */}
        <section className={styles.flaconSection}>
          <Container>
            <div className={styles.flaconGrid}>
              <div className={styles.flaconTextCol}>
                <span className={styles.chapterLabel}>Chapter III · The Vessel</span>
                <h2 className={styles.chapterHeading}>Sculpted in Heavy Glass &amp; Gold</h2>
                <div className={styles.decorativeDivider} />
                <p className={styles.narrativeText}>
                  A master fragrance deserves an architectural talisman. Each ATHAR
                  bottle is fashioned from high-density cosmetic crystal glass with
                  diamond-cut bevels that refract sunlight into golden caustics.
                </p>
                <p className={styles.narrativeText}>
                  Capped with a solid weighted gold closure engraved with the ATHAR seal,
                  and fitted with a precision Italian micro-mist pump calibrated to
                  atomize each droplet into an ethereal, featherlight vapor.
                </p>
                <div className={styles.craftBadges}>
                  <span className={styles.craftBadge}>Custom Weighted Glass</span>
                  <span className={styles.craftBadge}>Solid Gold Engraved Cap</span>
                  <span className={styles.craftBadge}>Italian Micro-Mist Atomizer</span>
                </div>
              </div>

              <div className={styles.flaconVisualCol}>
                <div className={styles.flaconImageFrame}>
                  <Image
                    src="/images/home/story-perfume.jpg"
                    alt="ATHAR bespoke perfume flacon resting on travertine stone"
                    fill
                    className={styles.flaconImg}
                    sizes="(max-width: 768px) 90vw, 540px"
                  />
                  <div className={styles.frameGoldBorder} aria-hidden="true" />
                </div>
              </div>
            </div>
          </Container>
        </section>

        {/* ===================================================================
            CHAPTER 4: The 4 Pillars of House ATHAR
            =================================================================== */}
        <section className={styles.pillarsSection}>
          <Container>
            <div className={styles.sectionHeader}>
              <span className={styles.chapterLabel}>Our Commitment</span>
              <h2 className={styles.chapterHeadingCenter}>The Four Pillars of ATHAR</h2>
            </div>

            <div className={styles.pillarsGrid}>
              <div className={styles.pillarItem}>
                <div className={styles.pillarIcon}>
                  <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 2C6.5 2 2 6.5 2 12c0 3.5 2 6.5 5 8 .5-4.5 3-8 8-10M12 2c3.5 3 5 7 5 11 0 4-3 7-7 8M12 2c1 5 0 9-3 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
                <h3 className={styles.pillarTitle}>Authentic Brands &amp; Purity</h3>
                <p className={styles.pillarDesc}>
                  Every batch is formulated without unnecessary synthetics or fillers, honoring the authentic lineage of fine perfume composition.
                </p>
              </div>

              <div className={styles.pillarItem}>
                <div className={styles.pillarIcon}>
                  <svg aria-hidden="true" viewBox="0 0 24 24"><polygon points="12 2 21 8.5 17 21 7 21 3 8.5 12 2" fill="none" stroke="currentColor" strokeWidth="1.8"/><line x1="3" y1="8.5" x2="21" y2="8.5" stroke="currentColor" strokeWidth="1.8"/><polyline points="12 2 17 8.5 12 21 7 8.5 12 2" fill="none" stroke="currentColor" strokeWidth="1.8"/></svg>
                </div>
                <h3 className={styles.pillarTitle}>Curated Niche Selection</h3>
                <p className={styles.pillarDesc}>
                  A deliberately constrained catalog. We only release blends that evoke profound emotional resonance and unmistakable presence.
                </p>
              </div>

              <div className={styles.pillarItem}>
                <div className={styles.pillarIcon}>
                  <svg aria-hidden="true" viewBox="0 0 24 24"><rect x="1" y="4" width="14" height="12" rx="1" fill="none" stroke="currentColor" strokeWidth="1.8"/><polygon points="15 8 19 8 22 11 22 16 15 16 15 8" fill="none" stroke="currentColor" strokeWidth="1.8"/><circle cx="5.5" cy="18.5" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.8"/><circle cx="18.5" cy="18.5" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.8"/></svg>
                </div>
                <h3 className={styles.pillarTitle}>White-Glove Delivery</h3>
                <p className={styles.pillarDesc}>
                  Shipped in temperature-buffered presentation packaging to protect delicate top notes from thermal shock during transit.
                </p>
              </div>

              <div className={styles.pillarItem}>
                <div className={styles.pillarIcon}>
                  <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" fill="none" stroke="currentColor" strokeWidth="1.8"/></svg>
                </div>
                <h3 className={styles.pillarTitle}>A More Beautiful You</h3>
                <p className={styles.pillarDesc}>
                  A scent that doesn&apos;t overpower who you are, but elevates your aura, creating an unforgettable sensory impression.
                </p>
              </div>
            </div>
          </Container>
        </section>

        {/* ===================================================================
            FINAL CALL TO EXPERIENCE: Find Your Signature
            =================================================================== */}
        <section className={styles.ctaSection}>
          <Container>
            <div className={styles.ctaCard}>
              <span className={styles.ctaEyebrow}>Your Scent Journey Awaits</span>
              <h2 className={styles.ctaTitle}>Experience the Essence of ATHAR</h2>
              <p className={styles.ctaText}>
                Step into our boutique catalog to discover our timeless bestsellers,
                or let our Fragrance Guide curate your next olfactory signature.
              </p>
              <div className={styles.ctaBtnRow}>
                <Link href="/shop" className={styles.ctaPrimaryBtn}>
                  <span>Explore Fragrance Catalog</span>
                  <span aria-hidden="true">→</span>
                </Link>
                <Link href="/#guide" className={styles.ctaSecondaryBtn}>
                  <span>Fragrance Guide</span>
                </Link>
              </div>
            </div>
          </Container>
        </section>
      </main>
      <Footer />
    </>
  );
}

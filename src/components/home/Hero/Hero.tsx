import Image from "next/image";
import { Button } from "@/components/ui/Button/Button";
import { Container } from "@/components/ui/Container/Container";
import { HeroNotes } from "./HeroNotes";
import { HeroMediaGate } from "./HeroMediaGate";
import styles from "./Hero.module.css";

export function Hero() {
  return <HeroMediaGate>
    <section className={styles.root} aria-labelledby="hero-title">
      <Image
        alt=""
        className={styles.background}
        fill
        priority
        data-hero-required
        sizes="100vw"
        src="/images/hero/hero-Athar.png"
      />

      <Container className={styles.content}>
        <div className={styles.copy}>
          <p className={`type-label ${styles.eyebrowText}`}>Timeless fragrances<br />for a brighter tomorrow</p>
          <span className={styles.eyebrowRule} aria-hidden="true" />
          <h1 className="type-display" id="hero-title">Scents That<br /><span className={styles.headlineSecondLine}>Stay With You</span></h1>
          <p className={styles.introduction}>More than a fragrance.<br />A part of your story.</p>
          <Button href="#fragrance-notes">Explore the fragrance <span aria-hidden="true">→</span></Button>
          <button className={styles.storyLink} disabled aria-label="Watch our story is not available yet" type="button">
            <span className={styles.storyPlay} aria-hidden="true">▶</span>
            <span>Watch<br />our story</span>
          </button>
        </div>

        <div className={styles.bottleStage}>
          <Image
            alt="ATHAR Eau de Parfum bottle"
            className={styles.bottle}
            height={1415}
            priority
            data-hero-required
            sizes="(max-width: 47.99rem) 82vw, (max-width: 75rem) 48vw, 38vw"
            src="/images/hero/atharperfume-img.png"
            width={1202}
          />
        </div>
      </Container>

      <Container className={styles.notesContainer}>
        <HeroNotes />
      </Container>
    </section>
  </HeroMediaGate>;
}

import { Container } from "@/components/ui/Container/Container";
import { Section } from "@/components/ui/Section/Section";
import { SectionHeading } from "@/components/ui/SectionHeading/SectionHeading";
import { BestsellersCarousel } from "./BestsellersCarousel";
import styles from "./Bestsellers.module.css";

export type FeaturedFragrance = {
  brand: string;
  name: string;
  concentration: string;
  size: string;
  image: string;
};

// Editorial display selection, not ATHAR offers or verified sales rankings.
// Replace these remote reference images with ATHAR-owned or licensed local assets
// before production.
const featuredFragrances: readonly FeaturedFragrance[] = [
  { brand: "Dior", name: "Sauvage", concentration: "Eau de Toilette", size: "100 ml", image: "https://images.matas.dk/trs/s365//encode/672698_1_20260313081500.jpg" },
  { brand: "Versace", name: "Eros", concentration: "Eau de Toilette", size: "100 ml", image: "https://static.thcdn.com/productimg/original/14271424-2605322025079028.jpg" },
  { brand: "Yves Saint Laurent", name: "Libre", concentration: "Eau de Parfum", size: "90 ml", image: "https://cdn.grupoelcorteingles.es/SGFM/dctm/MEDIA03/202401/18/00116960342711____20__1200x1200.jpg" },
  { brand: "Lancôme", name: "La Vie Est Belle", concentration: "Eau de Parfum", size: "100 ml", image: "https://labelleperfumes.com/cdn/shop/products/la-vie-est-belle1_large.webp?v=1762198509" },
  { brand: "Giorgio Armani", name: "Acqua di Giò", concentration: "Eau de Toilette", size: "100 ml", image: "https://images.matas.dk/trs/s890//encode/3614273955553_20240312133524.jpg" },
];

export function Bestsellers() {
  return (
    <Section className={styles.section} id="bestsellers" aria-labelledby="bestsellers-title">
      <Container>
        <div className={styles.headingRow}>
          <SectionHeading
            className={styles.heading}
            description="A considered selection of renowned fragrance signatures."
            id="bestsellers-title"
            title="Fragrance Icons"
          />
        </div>
        <BestsellersCarousel fragrances={featuredFragrances} />
      </Container>
    </Section>
  );
}

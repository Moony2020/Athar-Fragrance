import { Container } from "@/components/ui/Container/Container";

import styles from "./Footer.module.css";

const availableLinks = [
  { href: "#collections", label: "Collections" },
  { href: "#bestsellers", label: "Bestsellers" },
  { href: "/story", label: "Our Story" },
  { href: "#guide", label: "Fragrance Guide" },
] as const;

const deferredLinks = ["Boutiques", "Contact"] as const;

export function Footer() {
  return (
    <footer className={styles.root}>
      <Container>
        <div className={styles.top}>
          <div className={styles.brand}>
            <h2>ATHAR</h2>
            <p>Haute Parfumerie</p>
          </div>

          <nav className={styles.navigation} aria-label="Footer navigation">
            {availableLinks.map((link) => <a href={link.href} key={link.href}>{link.label}</a>)}
            {deferredLinks.map((label) => <span key={label}>{label}</span>)}
          </nav>
        </div>

        <div className={styles.bottom}>
          <p>© 2026 ATHAR Haute Parfumerie. All rights reserved.</p>
          <p>Crafted for distinguished sensibilities.</p>
        </div>
      </Container>
    </footer>
  );
}

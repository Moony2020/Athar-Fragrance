import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { Container } from "@/components/ui/Container/Container";
import { HeaderCartLink } from "./HeaderCartLink";
import { HeaderCartCount } from "./HeaderCartCount";
import { MobileMenu } from "./MobileMenu";
import { HeaderNavigation } from "./HeaderNavigation";
import styles from "./Header.module.css";
import { HeaderWishlistLink } from "./HeaderWishlistLink";
import { readCurrentCommerceWishlist } from "@/server/commerce/wishlist-read";

async function HeaderPersonalization() {
  await connection();

  const wishlist = await readCurrentCommerceWishlist();

  return (
    <>
      <HeaderWishlistLink initialCount={wishlist.products.length} />
      <Suspense fallback={<HeaderCartCount initialCount={0} />}><HeaderCartLink /></Suspense>
    </>
  );
}

export function Header() {
  return (
    <header className={styles.root}>
      <Container className={styles.inner}>
        <Link className={styles.brand} href="/" aria-label="ATHAR home">
          <span className={styles.wordmark}>ATHAR</span>
          <span className={styles.descriptor}>Haute Parfumerie</span>
        </Link>

        <HeaderNavigation />

        <div className={styles.actions}>
          <Link className={styles.action} aria-label="Search fragrances" href="/shop#fragrance-search">
            <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="10.8" cy="10.8" r="6.7" /><path d="m16 16 4.5 4.5" /></svg>
          </Link>
          <Link className={styles.action} aria-label="Account" href="/account">
            <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="7.5" r="3.8" /><path d="M4.5 21c.8-4 3.4-6 7.5-6s6.7 2 7.5 6" /></svg>
          </Link>
          <Suspense fallback={<><HeaderWishlistLink initialCount={0} /><HeaderCartCount initialCount={0} /></>}>
            <HeaderPersonalization />
          </Suspense>
          <MobileMenu />
        </div>
      </Container>
    </header>
  );
}

import Link from "next/link";

import { SignInForm } from "@/components/auth/SignInForm";
import styles from "../account.module.css";

export default function SignInPage() {
  return (
    <main className={styles.authShell}>
      <section className={styles.authCard} aria-labelledby="sign-in-title">
        <Link className={styles.authBrand} href="/" aria-label="ATHAR home">ATHAR</Link>
        <h1 id="sign-in-title">Sign in</h1>
        <p className={styles.authIntro}>Access your account, saved favourites, and checkout details.</p>
        <SignInForm />
        <p className={styles.authFooter}>
          New to ATHAR? <Link href="/account/register">Create an account</Link>
        </p>
      </section>
    </main>
  );
}

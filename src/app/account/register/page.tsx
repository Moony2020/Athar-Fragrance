import Link from "next/link";

import { RegisterForm } from "@/components/auth/RegisterForm";
import styles from "../account.module.css";

export default function RegisterPage() {
  return <main className={styles.authShell}>
    <section className={styles.authCard} aria-labelledby="register-title">
      <Link className={styles.authBrand} href="/">ATHAR</Link>
      <h1 id="register-title" className={styles.registerTitle}>Create your account</h1>
      <p className={styles.authIntro}>Create an account to save favourites and keep your checkout details close.</p>
      <RegisterForm />
      <p className={styles.authFooter}>Already have an account? <Link href="/account/sign-in">Sign in</Link></p>
    </section>
  </main>;
}

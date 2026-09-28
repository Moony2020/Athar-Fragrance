import Link from "next/link";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";
import styles from "../account.module.css";

export default function ForgotPasswordPage() {
  return (
    <main className={styles.authShell}>
      <section className={styles.authCard} aria-labelledby="forgot-password-title">
        <Link className={styles.authBrand} href="/" aria-label="ATHAR home">ATHAR</Link>
        <h1 id="forgot-password-title" className={styles.forgotTitle}>Forgot password?</h1>
        <p className={styles.authIntro}>Enter your account email and we will send reset instructions if an account exists.</p>
        <ForgotPasswordForm />
        <div className={styles.authLinks}>
          <p><Link href="/account/sign-in">Return to sign in</Link></p>
        </div>
      </section>
    </main>
  );
}

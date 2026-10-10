import type { Metadata } from "next";

import { AdminActivationForm } from "./AdminActivationForm";
import styles from "./admin-activate.module.css";

export const metadata: Metadata = {
  title: "Activate Admin Account | ATHAR",
  referrer: "no-referrer",
  robots: { index: false, follow: false, nocache: true },
};

export default function AdminActivationPage() {
  return (
    <main className={styles.page}>
      <section className={styles.card} aria-labelledby="activation-title">
        <p className={styles.brand}>ATHAR</p>
        <p className={styles.kicker}>ADMIN PLATFORM</p>
        <h1 id="activation-title">Set your password</h1>
        <p className={styles.intro}>Create a secure password to activate your administrator account.</p>
        <AdminActivationForm />
      </section>
    </main>
  );
}

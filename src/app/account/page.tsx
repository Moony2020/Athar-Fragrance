import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { SignOutButton } from "@/components/auth/SignOutButton";
import { ProfileForm } from "@/components/auth/ProfileForm";
import { auth } from "@/auth";
import { getCustomerProfile } from "@/server/identity/profile-service";
import { CatalogShell } from "@/components/catalog/CatalogShell/CatalogShell";
import styles from "./account.module.css";

export const instant = false;

export default async function AccountPage() {
  await connection();

  const session = await auth();
  if (!session?.user?.id) redirect("/account/sign-in");
  const profile = await getCustomerProfile(session.user.id);
  if (!profile) redirect("/account/sign-in");

  return (
    <CatalogShell>
      <div className={styles.shell}>
        <header className={styles.intro}>
          <nav aria-label="Breadcrumb" className={styles.breadcrumb}>
            <Link href="/">Home</Link>
            <span aria-hidden="true">/</span>
            <Link href="/shop">Shop</Link>
            <span aria-hidden="true">/</span>
            <span aria-current="page">Your Account</span>
          </nav>
          <h1>Your account</h1>
          <p>Welcome back, {profile.displayName}. Manage your profile and continue your fragrance journey.</p>
        </header>

      <div className={styles.grid}>
        <section className={`${styles.panel} ${styles.profilePanel}`} aria-labelledby="profile-heading">
          <div className={styles.panelHeading}>
            <p className={styles.eyebrow}>PROFILE</p>
            <h2 id="profile-heading">Your details</h2>
          </div>
          <label className={styles.email} htmlFor="account-email">Email<input id="account-email" aria-label="Email" autoComplete="off" value={profile.email} readOnly /></label>
          <ProfileForm
            actionsClassName={styles.profileActions}
            className={styles.profile}
            initialDisplayName={profile.displayName}
            secondaryActionClassName={styles.profileSecondaryAction}
            secondaryAction={<SignOutButton />}
          />
        </section>

        <aside className={styles.sidebar}>
          <section className={styles.panel} aria-labelledby="shopping-heading">
            <div className={styles.panelHeading}>
              <p className={styles.eyebrow}>SHOPPING</p>
              <h2 id="shopping-heading">Your bag</h2>
            </div>
            <p className={styles.panelCopy}>Review your selected fragrances or continue exploring the collection.</p>
            <div className={styles.actions}>
              <Link className={styles.primaryLink} href="/cart">View your bag</Link>
              <Link className={styles.secondaryLink} href="/shop">Continue shopping</Link>
            </div>
          </section>

          <section className={styles.panel} aria-labelledby="orders-heading">
            <div className={styles.panelHeading}>
              <p className={styles.eyebrow}>ORDERS</p>
              <h2 id="orders-heading">Your order history</h2>
            </div>
            <p className={styles.panelCopy}>Your confirmed orders will appear here after checkout and payment are available.</p>
          </section>

          <section className={styles.panel} aria-labelledby="security-heading">
            <div className={styles.panelHeading}>
              <p className={styles.eyebrow}>ACCOUNT SECURITY</p>
              <h2 id="security-heading">Password</h2>
            </div>
            <p className={styles.panelCopy}>To update your password, request a secure password-reset link sent to your email address.</p>
            <div className={styles.actions}>
              <Link className={styles.secondaryLink} href="/account/forgot-password">Reset password</Link>
            </div>
          </section>
        </aside>
      </div>

      </div>
    </CatalogShell>
  );
}

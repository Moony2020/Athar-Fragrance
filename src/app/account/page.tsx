import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { SignOutButton } from "@/components/auth/SignOutButton";
import { ProfileForm } from "@/components/auth/ProfileForm";
import { auth } from "@/auth";
import { userCommerceOwner } from "@/commerce/durable-contracts";
import { getCustomerProfile } from "@/server/identity/profile-service";
import { MongoOrderStore } from "@/server/orders/order-store";
import { formatMoneyMinor } from "@/lib/money";
import { getProductDetailData } from "@/server/catalog/services";
import { CatalogShell } from "@/components/catalog/CatalogShell/CatalogShell";
import styles from "./account.module.css";

export const instant = false;

export default async function AccountPage() {
  await connection();

  const session = await auth();
  if (!session?.user?.id) redirect("/account/sign-in");
  const profile = await getCustomerProfile(session.user.id);
  if (!profile) redirect("/account/sign-in");
  const rawOrders = await new MongoOrderStore().listForOwner(userCommerceOwner(session.user.id));
  const orderMedia: Record<string, string> = { "athar-test-no-01": "/images/catalog/athar-test-no-01-v1.webp", "cedar-study": "/images/catalog/cedar-study-v1.webp", "no-media-study": "/images/catalog/no-media-study-v1.webp", "velvet-sillage": "/images/catalog/velvet-sillage-v1.webp", "luminous-fig": "/images/catalog/luminous-fig-v1.webp" };
  const orders = await Promise.all(rawOrders.map(async (order) => ({ ...order, lines: await Promise.all(order.lines.map(async (line) => {
    if (line.productName && line.productName !== line.productSlug && line.mediaSrc) return line;
    const detail = await getProductDetailData(line.productSlug);
    return { ...line, productName: line.productName && line.productName !== line.productSlug ? line.productName : detail.product?.name ?? line.productSlug, brandName: line.brandName !== "ATHAR" ? line.brandName : detail.product?.brand.name ?? line.brandName, sizeMl: line.sizeMl ?? detail.product?.variants.find((variant) => variant.id === line.variantId)?.sizeMl ?? null, mediaSrc: line.mediaSrc ?? orderMedia[line.productSlug] ?? "/images/catalog/product-placeholder.svg" };
  })) })));

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
            {orders.length === 0 ? (
              <p className={styles.panelCopy}>Your confirmed orders will appear here after checkout and payment are available.</p>
            ) : (
              <div className={styles.orderList}>
                {orders.map((order) => (
                  <article className={styles.order} key={order.orderId}>
                    <div>
                      <strong>{order.orderId}</strong>
                      <span>{order.createdAt.toLocaleDateString("en-SE")}</span>
                    </div>
                    <div className={styles.orderLines}>
                      {order.lines.map((line) => (
                        <div className={styles.orderLine} key={`${line.productSlug}:${line.variantId}`}>
                          <Link aria-label={`View ${line.productName}`} className={styles.orderImageLink} href={`/products/${line.productSlug}`}>
                            <div className={styles.orderImage}>
                              {line.mediaSrc ? <Image alt={line.productName} fill sizes="3.5rem" src={line.mediaSrc} /> : <span>ATHAR</span>}
                            </div>
                            <div className={styles.imageBadge}>{line.quantity}</div>
                          </Link>
                          <div className={styles.orderProduct}>
                            <Link className={styles.orderProductLink} href={`/products/${line.productSlug}`}>{line.productName}</Link>
                            <small>{[line.brandName, line.sizeMl ? `${line.sizeMl} ml` : "Fragrance"].filter(Boolean).join(" · ")}</small>
                          </div>
                          <strong className={styles.orderLinePrice}>{formatMoneyMinor(line.subtotalMinor, line.currency)}</strong>
                        </div>
                      ))}
                    </div>
                    <div className={styles.orderMeta}>
                      <small>{order.lines.length > 1 ? `${order.lines.length} items · ` : ""}Delivery · PostNord · {order.provider === "paypal" ? "PayPal" : "Stripe"}</small>
                      <span className={styles.orderTotal}><b>Total</b><strong>{formatMoneyMinor(order.totalMinor, order.currency)}</strong></span>
                    </div>
                  </article>
                ))}
              </div>
            )}
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

import { cookies } from "next/headers";
import { connection } from "next/server";
import { CatalogShell } from "@/components/catalog/CatalogShell/CatalogShell";
import { CustomerOrderDetails } from "@/components/orders/CustomerOrderDetails";
import { guestOrderAccessSessionCookieName, genericOrderAccessMessage } from "@/server/orders/guest-order-access-document";
import { readGuestOrderFromSession } from "@/server/orders/guest-order-access-service";
import styles from "../lookup/lookup.module.css";
export const instant = false;
export default async function GuestOrderPage() {
  await connection();
  const secret = (await cookies()).get(guestOrderAccessSessionCookieName)?.value;
  const order = await readGuestOrderFromSession(secret);
  if (!order) return <CatalogShell><main className={styles.shell}><section className={styles.card}><h1>Order unavailable</h1><p>{genericOrderAccessMessage}</p></section></main></CatalogShell>;
  return <CatalogShell><main className={styles.shell}><CustomerOrderDetails order={order} /></main></CatalogShell>;
}

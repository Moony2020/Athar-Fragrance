import Link from "next/link";
import { CatalogShell } from "@/components/catalog/CatalogShell/CatalogShell";
import { GuestLookupForm } from "@/components/orders/GuestLookupForm";
import styles from "./lookup.module.css";
export const instant = false;
export default function GuestOrderLookupPage() { return <CatalogShell><main className={styles.shell}><section className={styles.card} aria-labelledby="guest-order-lookup-title"><p className={styles.kicker}>GUEST ORDER ACCESS</p><h1 id="guest-order-lookup-title">View your order details</h1><p>Enter the order number and checkout email used for your purchase.</p><GuestLookupForm /><p className={styles.account}>Have an account? <Link href="/account">View your account orders</Link></p></section></main></CatalogShell>; }

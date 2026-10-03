import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { auth } from "@/auth";
import { CatalogShell } from "@/components/catalog/CatalogShell/CatalogShell";
import { CustomerOrderDetails } from "@/components/orders/CustomerOrderDetails";
import { userCommerceOwner } from "@/commerce/durable-contracts";
import { toCustomerOrderReadModel } from "@/orders/customer-order-read-model";
import { MongoOrderStore } from "@/server/orders/order-store";
import styles from "@/app/orders/lookup/lookup.module.css";
export const instant = false;
export default async function AccountOrderDetailPage({ params }: { params: Promise<{ orderId: string }> }) { await connection(); const session = await auth(); if (!session?.user?.id) redirect("/account/sign-in"); const { orderId } = await params; const order = await new MongoOrderStore().findForOwnerByOrderId(userCommerceOwner(session.user.id), orderId); if (!order) notFound(); return <CatalogShell><main className={styles.shell}><CustomerOrderDetails order={toCustomerOrderReadModel(order)} /></main></CatalogShell>; }

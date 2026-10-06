import { redirect } from "next/navigation";
import { connection } from "next/server";

import { resolveCurrentAdminAuthorization } from "@/server/admin/current-authorization";
import styles from "./admin.module.css";

export const instant = false;

export default async function AdminPage() {
  await connection();
  const authorization = await resolveCurrentAdminAuthorization();
  if (authorization.kind === "unauthenticated") redirect("/account/sign-in");

  if (authorization.kind === "forbidden") {
    return <main className={styles.denied}><p className={styles.eyebrow}>ATHAR ADMIN</p><h1>Access denied</h1><p>You do not have permission to view this area.</p></main>;
  }

  return (
    <main className={styles.shell}>
      <aside className={styles.sidebar}><p className={styles.brand}>ATHAR</p><span>HAUTE PARFUMERIE</span></aside>
      <section className={styles.content}><p className={styles.eyebrow}>ADMIN PLATFORM</p><h1>Admin access verified</h1><p>This protected shell contains no operational tools or store data yet.</p></section>
    </main>
  );
}

import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";
import styles from "../account.module.css";

export const metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" as const };

export default function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  return <main className={styles.shell}><h1>Choose a new password</h1><p>Use a password of at least 12 characters.</p><Suspense fallback={<p role="status">Loading reset form…</p>}><ResetPasswordContent searchParams={searchParams} /></Suspense></main>;
}

async function ResetPasswordContent({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return <ResetPasswordForm token={typeof token === "string" ? token : ""} />;
}

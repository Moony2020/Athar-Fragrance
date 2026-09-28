"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

export function ResetPasswordForm({ token }: { token: string }) {
  const [message, setMessage] = useState(""); const [error, setError] = useState(""); const [pending, setPending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage(""); setError(""); setPending(true);
    const form = new FormData(event.currentTarget);
    if (form.get("password") !== form.get("confirmPassword")) { setError("Passwords do not match."); setPending(false); return; }
    try {
      const response = await fetch("/api/auth/reset-password", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, password: form.get("password") }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error || "This reset link is invalid or expired."); setMessage(body.message);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "This reset link is invalid or expired."); }
    finally { setPending(false); }
  }
  return <form onSubmit={submit} aria-label="Reset password">
    <label htmlFor="new-password">New password</label><input id="new-password" name="password" type="password" minLength={12} maxLength={128} autoComplete="new-password" required />
    <label htmlFor="confirm-password">Confirm new password</label><input id="confirm-password" name="confirmPassword" type="password" minLength={12} maxLength={128} autoComplete="new-password" required />
    {message && <p role="status">{message} <Link href="/account/sign-in">Sign in</Link></p>}{error && <p role="alert">{error}</p>}
    <button type="submit" disabled={pending || !token}>{pending ? "Updating…" : "Update password"}</button>
  </form>;
}

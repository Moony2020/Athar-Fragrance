"use client";

import { FormEvent, useState } from "react";

export function ForgotPasswordForm() {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage(""); setError(""); setPending(true);
    try {
      const response = await fetch("/api/auth/forgot-password", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: new FormData(event.currentTarget).get("email") }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Please try again later.");
      setMessage(body.message);
    } catch { setError("Password reset is temporarily unavailable. Please try again later."); }
    finally { setPending(false); }
  }
  return <form method="post" onSubmit={submit} aria-label="Forgot password" aria-busy={pending}>
    <label htmlFor="forgot-email">Email</label><input id="forgot-email" name="email" type="email" autoComplete="email" required />
    {message && <p role="status">{message}</p>}{error && <p role="alert">{error}</p>}
    <button type="submit" disabled={pending}>{pending ? "Sending…" : "Send reset link"}</button>
  </form>;
}

"use client";

import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";

export function SignInForm() {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);
    const form = new FormData(event.currentTarget);
    const result = await signIn("credentials", { email: form.get("email"), password: form.get("password"), redirect: false });
    setPending(false);
    if (!result || result.error) { setError("Unable to sign in with those details."); return; }
    window.location.assign("/account");
  }

  return <form method="post" onSubmit={submit} aria-label="Sign in">
    <label htmlFor="signin-email">Email</label>
    <input id="signin-email" name="email" type="email" autoComplete="email" required />
    <label htmlFor="signin-password">Password</label>
    <input id="signin-password" name="password" type="password" autoComplete="current-password" required />
    {error ? <p role="alert">{error}</p> : null}
    <button type="submit" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>
  </form>;
}

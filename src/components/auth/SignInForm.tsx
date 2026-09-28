"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import styles from "./SignInForm.module.css";

export function SignInForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);
    const form = new FormData(event.currentTarget);
    const result = await signIn("credentials", { email: form.get("email"), password: form.get("password"), redirect: false });
    setPending(false);
    if (!result || result.error) {
      setError("Invalid email or password. Please check your credentials and try again.");
      return;
    }
    router.replace("/account");
  }

  return <form method="post" onSubmit={submit} aria-label="Sign in" aria-busy={pending}>
    <label htmlFor="signin-email">Email</label>
    <input id="signin-email" name="email" type="email" autoComplete="email" required />
    <div className={styles.passwordRow}>
      <label htmlFor="signin-password">Password</label>
      <Link href="/account/forgot-password">Forgot password?</Link>
    </div>
    <div className={styles.passwordField}>
      <input className={styles.passwordInput} id="signin-password" name="password" type={passwordVisible ? "text" : "password"} autoComplete="current-password" required />
      <button className={styles.passwordToggle} type="button" onClick={() => setPasswordVisible((visible) => !visible)} aria-label={passwordVisible ? "Hide secret" : "Show secret"} aria-pressed={passwordVisible}>
        {passwordVisible
          ? <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m3 3 18 18" /><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" /><path d="M9.9 5.1A10.8 10.8 0 0 1 12 4.9c5.1 0 8.7 4.6 9.7 7.1a11.8 11.8 0 0 1-3.2 4.2" /><path d="M6.2 6.2A11.8 11.8 0 0 0 2.3 12C3.3 14.5 6.9 19.1 12 19.1c1.1 0 2.1-.2 3-.5" /></svg>
          : <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M2.3 12C3.3 9.5 6.9 4.9 12 4.9S20.7 9.5 21.7 12c-1 2.5-4.6 7.1-9.7 7.1S3.3 14.5 2.3 12Z" /><circle cx="12" cy="12" r="2.8" /></svg>}
      </button>
    </div>
    {error ? <p role="alert">{error}</p> : null}
    <button type="submit" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>
  </form>;
}

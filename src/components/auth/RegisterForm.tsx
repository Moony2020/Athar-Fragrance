"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import styles from "./SignInForm.module.css";

export function RegisterForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [password, setPassword] = useState("");

  const hasMinLength = password.length >= 12;
  const hasLetter = /[A-Za-z]/.test(password);

  const passwordChecks = [
    hasMinLength,
    hasLetter,
    /\d/.test(password),
    /[a-z]/.test(password) && /[A-Z]/.test(password),
    /[^A-Za-z\d]/.test(password),
  ];
  const passwordScore = password ? passwordChecks.filter(Boolean).length : 0;

  let strengthLabel = "Weak";
  let strengthColor = "#d32f2f"; // Red

  if (!hasMinLength || !hasLetter) {
    strengthLabel = "Weak";
    strengthColor = "#d32f2f";
  } else if (passwordScore <= 2) {
    strengthLabel = "Fair";
    strengthColor = "#e67e22"; // Warm Orange
  } else if (passwordScore <= 4) {
    strengthLabel = "Good";
    strengthColor = "#27ae60"; // Soft Green
  } else {
    strengthLabel = "Strong";
    strengthColor = "#1e824c"; // Deep Green
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!hasMinLength) {
      setError("Password must be at least 12 characters.");
      return;
    }
    if (!hasLetter) {
      setError("Password must contain at least one letter.");
      return;
    }

    setPending(true);
    const form = new FormData(event.currentTarget);
    const email = form.get("email");
    const submittedPassword = form.get("password");
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password: submittedPassword }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setPending(false);
        setError(data?.error || "Unable to create account. Please try again.");
        return;
      }

      const result = await signIn("credentials", { email, password: submittedPassword, redirect: false });
      setPending(false);
      if (!result || result.error) {
        setError("Your account was created, but we could not sign you in automatically. Please sign in.");
        return;
      }
      router.replace("/account");
    } catch {
      setPending(false);
      setError("A connection error occurred. Please try again.");
    }
  }

  return (
    <form method="post" onSubmit={submit} aria-label="Create account" aria-busy={pending}>
      <label htmlFor="register-email">Email</label>
      <input id="register-email" name="email" type="email" autoComplete="email" required />
      <div className={styles.passwordRow}><label htmlFor="register-password">Password</label></div>
      <div className={styles.passwordField}>
        <input
          className={styles.passwordInput}
          id="register-password"
          name="password"
          type={passwordVisible ? "text" : "password"}
          minLength={12}
          maxLength={128}
          autoComplete="new-password"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            if (error) setError("");
          }}
          required
        />
        <button
          className={styles.passwordToggle}
          type="button"
          onClick={() => setPasswordVisible((visible) => !visible)}
          aria-label={passwordVisible ? "Hide secret" : "Show secret"}
          aria-pressed={passwordVisible}
        >
          {passwordVisible
            ? <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m3 3 18 18" /><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" /><path d="M9.9 5.1A10.8 10.8 0 0 1 12 4.9c5.1 0 8.7 4.6 9.7 7.1a11.8 11.8 0 0 1-3.2 4.2" /><path d="M6.2 6.2A11.8 11.8 0 0 0 2.3 12C3.3 14.5 6.9 19.1 12 19.1c1.1 0 2.1-.2 3-.5" /></svg>
            : <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M2.3 12C3.3 9.5 6.9 4.9 12 4.9S20.7 9.5 21.7 12c-1 2.5-4.6 7.1-9.7 7.1S3.3 14.5 2.3 12Z" /><circle cx="12" cy="12" r="2.8" /></svg>}
        </button>
      </div>
      {password ? (
        <div className={styles.passwordStrength} aria-live="polite">
          <div
            className={styles.passwordStrengthTrack}
            role="progressbar"
            aria-label="Password strength"
            aria-valuemin={0}
            aria-valuemax={5}
            aria-valuenow={passwordScore}
          >
            <span style={{ width: `${Math.max(passwordScore * 20, 18)}%`, backgroundColor: strengthColor }} />
          </div>
          <span style={{ color: strengthColor, fontWeight: 600 }}>{strengthLabel}</span>
        </div>
      ) : null}
      <ul className={styles.passwordRules} aria-label="Password requirements">
        <li className={`${styles.ruleItem} ${hasMinLength ? styles.ruleMet : ""}`}>
          <span className={styles.ruleIcon}>{hasMinLength ? "✓" : "○"}</span>
          At least 12 characters
        </li>
        <li className={`${styles.ruleItem} ${hasLetter ? styles.ruleMet : ""}`}>
          <span className={styles.ruleIcon}>{hasLetter ? "✓" : "○"}</span>
          At least one letter
        </li>
      </ul>
      {error ? <p role="alert">{error}</p> : null}
      <button type="submit" disabled={pending}>{pending ? "Creating account…" : "Create account"}</button>
    </form>
  );
}

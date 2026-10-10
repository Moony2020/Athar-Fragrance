"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

import styles from "./admin-activate.module.css";

type ViewState = "loading" | "ready" | "invalid" | "success" | "unavailable";

export function AdminActivationForm() {
  const pendingToken = useRef<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [state, setState] = useState<ViewState>("loading");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmationVisible, setConfirmationVisible] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const fragment = window.location.hash;
    if (fragment) {
      pendingToken.current = new URLSearchParams(fragment.slice(1)).get("token");
      window.history.replaceState(window.history.state, "", window.location.pathname);
    }
    const frame = window.requestAnimationFrame(() => {
      // Strict Mode re-runs this effect after cleanup; the fragment is already gone.
      const value = pendingToken.current;
      if (value && /^[A-Za-z0-9_-]{32,128}$/.test(value)) {
        setToken(value);
        setState("ready");
      } else {
        setState("invalid");
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    if (!token) { setState("invalid"); return; }
    if (password !== confirmation) { setMessage("The passwords do not match."); return; }
    setState("loading");
    try {
      const response = await fetch("/api/admin/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ token, password }),
        cache: "no-store",
        credentials: "omit",
        referrerPolicy: "no-referrer",
      });
      const result: unknown = await response.json().catch(() => null);
      pendingToken.current = null;
      setToken(null);
      setPassword("");
      setConfirmation("");
      if (response.ok && result && typeof result === "object" && "status" in result && result.status === "success") {
        setState("success");
      } else if (response.status >= 500 || response.status === 429) {
        setState("unavailable");
      } else {
        setState("invalid");
      }
    } catch {
      pendingToken.current = null;
      setToken(null);
      setState("unavailable");
      setPassword("");
      setConfirmation("");
    }
  }

  return (
    <div aria-live="polite" aria-busy={state === "loading"}>
      {state === "loading" && <p className={styles.notice}>Please wait…</p>}
      {state === "invalid" && <p className={styles.notice} role="status">This activation link is invalid, expired, or already used. Request a new invitation from the ATHAR owner.</p>}
      {state === "unavailable" && <p className={styles.notice} role="status">Activation is temporarily unavailable. Please try again later or contact the ATHAR owner.</p>}
      {state === "success" && <div className={styles.notice} role="status"><p>Your Admin account is activated.</p><p>Admin sign-in will be available in a later Admin Portal gate.</p></div>}
      {state === "ready" && (
        <form className={styles.form} onSubmit={submit}>
          <label htmlFor="admin-password">Password</label>
          <div className={styles.passwordField}>
            <input id="admin-password" name="password" type={passwordVisible ? "text" : "password"} autoComplete="new-password" minLength={12} maxLength={128} required value={password} onChange={(event) => setPassword(event.target.value)} />
            <button className={styles.passwordToggle} type="button" onClick={() => setPasswordVisible((visible) => !visible)} aria-label={passwordVisible ? "Hide password" : "Show password"} aria-pressed={passwordVisible}>
              <VisibilityIcon visible={passwordVisible} />
            </button>
          </div>
          <label htmlFor="admin-password-confirmation">Confirm password</label>
          <div className={styles.passwordField}>
            <input id="admin-password-confirmation" name="passwordConfirmation" type={confirmationVisible ? "text" : "password"} autoComplete="new-password" minLength={12} maxLength={128} required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
            <button className={styles.passwordToggle} type="button" onClick={() => setConfirmationVisible((visible) => !visible)} aria-label={confirmationVisible ? "Hide confirm password" : "Show confirm password"} aria-pressed={confirmationVisible}>
              <VisibilityIcon visible={confirmationVisible} />
            </button>
          </div>
          <p className={styles.policy}>Use at least 12 characters and include at least one letter.</p>
          {message && <p className={styles.error} role="alert">{message}</p>}
          <button className={styles.submit} type="submit">Activate Admin account</button>
        </form>
      )}
    </div>
  );
}

function VisibilityIcon({ visible }: { visible: boolean }) {
  return visible
    ? <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m3 3 18 18" /><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" /><path d="M9.9 5.1A10.8 10.8 0 0 1 12 4.9c5.1 0 8.7 4.6 9.7 7.1a11.8 11.8 0 0 1-3.2 4.2" /><path d="M6.2 6.2A11.8 11.8 0 0 0 2.3 12C3.3 14.5 6.9 19.1 12 19.1c1.1 0 2.1-.2 3-.5" /></svg>
    : <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M2.3 12C3.3 9.5 6.9 4.9 12 4.9S20.7 9.5 21.7 12c-1 2.5-4.6 7.1-9.7 7.1S3.3 14.5 2.3 12Z" /><circle cx="12" cy="12" r="2.8" /></svg>;
}

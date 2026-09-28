"use client";

import { FormEvent, type ReactNode, useState } from "react";

type ProfileFormProps = {
  initialDisplayName: string;
  className?: string;
  actionsClassName?: string;
  secondaryActionClassName?: string;
  secondaryAction?: ReactNode;
};

export function ProfileForm({ initialDisplayName, className, actionsClassName, secondaryActionClassName, secondaryAction }: ProfileFormProps) {
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [status, setStatus] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setStatus("");
    const response = await fetch("/api/account/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName }),
    });
    setPending(false);
    setStatus(response.ok ? "Profile saved." : "Unable to save profile.");
  }

  return <form className={className} onSubmit={submit} aria-label="Profile details">
    <label htmlFor="displayName">Display name</label>
    <input id="displayName" name="displayName" autoComplete="off" value={displayName} onChange={(event) => setDisplayName(event.target.value)} minLength={1} maxLength={80} required />
    <div className={actionsClassName}>
      <button type="submit" disabled={pending}>{pending ? "Saving…" : "Save profile"}</button>
      {secondaryAction ? <div className={secondaryActionClassName}>{secondaryAction}</div> : null}
    </div>
    {status ? <p role="status">{status}</p> : null}
  </form>;
}

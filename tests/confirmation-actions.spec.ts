import { test, expect } from "@playwright/test";

import { getConfirmationActions } from "../src/app/checkout/confirmation/confirmation-actions";

test.describe("checkout confirmation actions", () => {
  test("guest success uses sign in instead of account history", () => {
    expect(getConfirmationActions(false, true)).toEqual([
      { href: "/", label: "Continue shopping", kind: "primary" },
      { href: "/account/sign-in", label: "Sign in", kind: "secondary" },
    ]);
  });

  test("authenticated success keeps account action", () => {
    expect(getConfirmationActions(true, true)).toEqual([
      { href: "/", label: "Continue shopping", kind: "primary" },
      { href: "/account", label: "View your account", kind: "secondary" },
    ]);
  });

  test("payment failure keeps return-to-checkout action", () => {
    expect(getConfirmationActions(false, false)).toEqual([
      { href: "/checkout", label: "Return to checkout", kind: "primary" },
    ]);
  });
});

export type ConfirmationAction = {
  href: string;
  label: string;
  kind: "primary" | "secondary";
};

export function getConfirmationActions(authenticated: boolean, successful: boolean): ConfirmationAction[] {
  if (!successful) return [{ href: "/checkout", label: "Return to checkout", kind: "primary" }];
  return [
    { href: "/", label: "Continue shopping", kind: "primary" },
    authenticated ? { href: "/account", label: "View your account", kind: "secondary" } : { href: "/orders/lookup", label: "View order details", kind: "secondary" },
  ];
}

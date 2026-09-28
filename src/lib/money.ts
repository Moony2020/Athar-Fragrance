/** Shared presentation formatter for canonical integer minor-unit prices. */
export function formatMoneyMinor(value: number, currency: string): string {
  const major = value / 100;
  if (currency === "SEK") return `${new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 0 }).format(major)} kr`;
  return new Intl.NumberFormat("en", { style: "currency", currency, maximumFractionDigits: 0 }).format(major);
}

/** Formats an exact minor-unit amount when a customer-facing breakdown includes öre. */
export function formatMoneyMinorExact(value: number, currency: string): string {
  const major = value / 100;
  const options = value % 100 === 0
    ? { maximumFractionDigits: 0 }
    : { minimumFractionDigits: 2, maximumFractionDigits: 2 };
  if (currency === "SEK") return `${new Intl.NumberFormat("sv-SE", options).format(major)} kr`;
  return new Intl.NumberFormat("en", { style: "currency", currency, ...options }).format(major);
}

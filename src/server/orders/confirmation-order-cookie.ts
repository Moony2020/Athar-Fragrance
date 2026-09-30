export const confirmationOrderCookieName = "athar_confirmation_order";

export const confirmationOrderCookieOptions = {
  httpOnly: true,
  maxAge: 15 * 60,
  path: "/checkout/confirmation",
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
};

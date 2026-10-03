import "server-only";

export const databaseCollections = {
  brands: "brands",
  collections: "collections",
  products: "products",
  carts: "carts",
  wishlists: "wishlists",
  checkoutDrafts: "checkout_drafts",
  inventoryReservations: "inventory_reservations",
  paymentAttempts: "payment_attempts",
  orders: "orders",
  users: "users",
  userCredentials: "user_credentials",
  passwordResetTokens: "password_reset_tokens",
  commerceMerges: "commerce_merges",
  emailDeliveries: "email_deliveries",
  guestOrderAccessSessions: "guest_order_access_sessions",
  orderLookupRateLimits: "order_lookup_rate_limits",
} as const;

export type DatabaseCollectionName = (typeof databaseCollections)[keyof typeof databaseCollections];

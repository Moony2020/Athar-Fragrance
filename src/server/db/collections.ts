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
  privilegedAuditEvents: "privileged_audit_events",
  adminInvitations: "admin_invitations",
  adminAuthRateLimits: "admin_auth_rate_limits",
  adminAuthRateLimitAttempts: "admin_auth_rate_limit_attempts",
} as const;

export type DatabaseCollectionName = (typeof databaseCollections)[keyof typeof databaseCollections];

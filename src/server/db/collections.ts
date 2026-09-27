import "server-only";

export const databaseCollections = {
  brands: "brands",
  collections: "collections",
  products: "products",
  carts: "carts",
  wishlists: "wishlists",
  checkoutDrafts: "checkout_drafts",
  users: "users",
  userCredentials: "user_credentials",
  passwordResetTokens: "password_reset_tokens",
  commerceMerges: "commerce_merges",
} as const;

export type DatabaseCollectionName = (typeof databaseCollections)[keyof typeof databaseCollections];

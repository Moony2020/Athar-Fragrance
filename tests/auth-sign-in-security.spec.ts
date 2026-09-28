import { expect, test } from "@playwright/test";
import argon2 from "argon2";
import { randomBytes } from "node:crypto";
import { MongoClient, ObjectId } from "mongodb";

const databaseReady = Boolean(process.env.MONGODB_URI && process.env.MONGODB_DB_NAME === "athar_stage55_test");

test("successful credentials sign-in keeps secrets out of the URL", async ({ page }) => {
  test.skip(!databaseReady, "requires athar_stage55_test");
  const userId = randomBytes(32).toString("base64url");
  const email = `auth-security-${randomBytes(8).toString("hex")}@example.invalid`;
  const password = `Auth-${randomBytes(16).toString("base64url")}`;
  const now = new Date();
  const mongo = new MongoClient(process.env.MONGODB_URI!, { serverSelectionTimeoutMS: 8_000 });
  const requestUrls: string[] = [];

  try {
    await mongo.connect();
    const database = mongo.db("athar_stage55_test");
    await database.collection("users").insertOne({ _id: new ObjectId(), userId, normalizedEmail: email, displayName: "Auth Security Fixture", createdAt: now, updatedAt: now });
    await database.collection("user_credentials").insertOne({ _id: new ObjectId(), userId, passwordHash: await argon2.hash(password, { type: argon2.argon2id, timeCost: 3, memoryCost: 65_536, parallelism: 4 }), disabledAt: null, securityVersion: 0, createdAt: now, updatedAt: now });

    page.on("request", (request) => requestUrls.push(request.url()));
    await page.goto("/account/sign-in");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/account$/);
    expect(decodeURIComponent(page.url())).not.toContain(password);
    expect(decodeURIComponent(page.url())).not.toContain(email);
    expect(requestUrls.some((url) => {
      const decodedUrl = decodeURIComponent(url);
      return decodedUrl.includes(email) || decodedUrl.includes(password);
    })).toBe(false);

    const sessionResponse = await page.request.get("/api/auth/session");
    expect(sessionResponse.ok()).toBe(true);
    const session = await sessionResponse.json() as { user?: { id?: string } };
    expect(session.user?.id).toBe(userId);
  } finally {
    const database = mongo.db("athar_stage55_test");
    await database.collection("user_credentials").deleteMany({ userId }).catch(() => undefined);
    await database.collection("users").deleteMany({ userId }).catch(() => undefined);
    await mongo.close().catch(() => undefined);
  }
});

import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

/**
 * These tests cover the "your token is missing or expired" paths around /auth:
 * the app must always land on a readable page (the sign-in form, or a signed-in
 * page with an inline session-expired notice) and never a blank screen.
 */

function supabaseRef() {
  const env = readFileSync(new URL("../.env", import.meta.url), "utf8");
  const url = /VITE_SUPABASE_URL="?([^"\n]+)"?/.exec(env)?.[1] ?? "";
  return new URL(url).hostname.split(".")[0]!;
}

const STORAGE_KEY = `sb-${supabaseRef()}-auth-token`;

const EXPIRED_SESSION = {
  access_token: "aaa.bbb.ccc",
  refresh_token: "expired-refresh-token",
  token_type: "bearer",
  expires_in: 3600,
  expires_at: 1,
  user: { id: "00000000-0000-0000-0000-000000000001", email: "expired@example.test" },
};

/** The page must render real content, never an empty document. */
async function expectNotBlank(page: Page) {
  await expect(page.locator("body")).not.toBeEmpty();
  const text = ((await page.locator("body").innerText()) || "").trim();
  expect(text.length).toBeGreaterThan(20);
}

async function seedExpiredSession(page: Page) {
  await page.goto("/");
  await page.evaluate(
    ([key, session]) => window.localStorage.setItem(key as string, session as string),
    [STORAGE_KEY, JSON.stringify(EXPIRED_SESSION)] as const,
  );
}

test.describe("/auth 401 handling", () => {
  test("no session at all sends you to a readable sign-in page", async ({ page }) => {
    await page.goto("/needs");
    await page.waitForURL("**/auth**");
    await expect(page.getByRole("heading", { name: /pick up where you left off/i })).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expectNotBlank(page);
  });

  test("an expired session is rejected and falls back to the sign-in form", async ({ page }) => {
    // Supabase rejects the stale token, exactly as the live API would.
    await page.route("**/auth/v1/user**", (route) =>
      route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ code: 401, msg: "invalid JWT: token is expired" }),
      }),
    );
    await page.route("**/auth/v1/token**", (route) =>
      route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ error: "invalid_grant", error_description: "refresh token expired" }),
      }),
    );

    await seedExpiredSession(page);
    await page.goto("/needs");

    await page.waitForURL("**/auth**");
    await expect(page.getByRole("button", { name: /continue with google/i })).toBeVisible();
    await expectNotBlank(page);
  });

  test("a 401 from a server function shows an inline notice, not a blank page", async ({
    page,
  }) => {
    // Auth gate passes (client thinks it is signed in)…
    await page.route("**/auth/v1/user**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(EXPIRED_SESSION.user),
      }),
    );
    await page.route("**/auth/v1/token**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ...EXPIRED_SESSION,
          expires_at: Math.floor(Date.now() / 1000) + 3600,
        }),
      }),
    );
    // …but every server function replies with the middleware's JSON 401.
    await page.route("**/_serverFn/**", (route) =>
      route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ error: "Unauthorized", reason: "No authorization header provided" }),
      }),
    );

    await seedExpiredSession(page);
    await page.goto("/needs");

    const notice = page.getByTestId("needs-error");
    await expect(notice).toBeVisible();
    await expect(notice).toContainText(/sign in again/i);
    await expect(notice.getByRole("link", { name: /sign in/i })).toHaveAttribute(
      "href",
      /\/auth/,
    );
    await expectNotBlank(page);
  });
});

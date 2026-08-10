import { test, expect } from "@playwright/test";
import { mockSignIn, mockProfile, mockEntries } from "./mocks";

test.describe("sign in", () => {
  test("shows a sign-in form when logged out", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Moon & Mood")).toBeVisible();
    await expect(page.getByPlaceholder("Email")).toBeVisible();
    await expect(page.getByPlaceholder("Password")).toBeVisible();
  });

  test("toggles between sign in and create account copy", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
    await page.getByText("First time here? Create an account").click();
    await expect(page.getByRole("button", { name: "Create account" })).toBeVisible();
  });

  test("signing in with valid credentials reveals the tracker", async ({ page }) => {
    await mockSignIn(page);
    await mockProfile(page, null);
    await mockEntries(page, []);

    await page.goto("/");
    await page.getByPlaceholder("Email").fill("alex@example.com");
    await page.getByPlaceholder("Password").fill("correct-horse-battery-staple");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByText("personal moon & mood log")).toBeVisible();
  });

  test("surfaces the Supabase error message on failed sign in", async ({ page }) => {
    await page.route("**/auth/v1/token*", async (route) => {
      await route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ error: "invalid_grant", error_description: "Invalid login credentials" }),
      });
    });

    await page.goto("/");
    await page.getByPlaceholder("Email").fill("alex@example.com");
    await page.getByPlaceholder("Password").fill("wrong-password");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByText(/invalid login credentials/i)).toBeVisible();
  });

  test("prompts to set up a birth chart when none exists yet", async ({ page }) => {
    await mockSignIn(page);
    await mockProfile(page, null);
    await mockEntries(page, []);

    await page.goto("/");
    await page.getByPlaceholder("Email").fill("alex@example.com");
    await page.getByPlaceholder("Password").fill("correct-horse-battery-staple");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByText(/Set up now/)).toBeVisible();
  });
});

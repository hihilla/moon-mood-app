import { test, expect } from "@playwright/test";
import { mockSignIn, mockProfile, mockEntries, FAKE_CHART } from "./mocks";

test.describe("onboarding", () => {
  test.beforeEach(async ({ page }) => {
    await mockSignIn(page);
    await mockProfile(page, null);
    await mockEntries(page, []);

    // Our own API routes — same-origin, interceptable at the browser boundary.
    await page.route("**/api/geocode*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          results: [
            { name: "Amsterdam", admin1: "North Holland", country: "Netherlands", latitude: 52.374, longitude: 4.8897, timezone: "Europe/Amsterdam" },
          ],
        }),
      });
    });

    await page.route("**/api/natal-chart", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(FAKE_CHART),
      });
    });

    // Sign in first, then navigate to onboarding.
    await page.goto("/");
    await page.getByPlaceholder("Email").fill("alex@example.com");
    await page.getByPlaceholder("Password").fill("correct-horse-battery-staple");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("personal moon & mood log")).toBeVisible();
    await page.goto("/onboarding");
  });

  test("requires a place before submitting, even with a date filled in", async ({ page }) => {
    // The date input has `required`, so the browser's native validation blocks
    // submission before our JS runs if it's empty too — filling it in is what
    // lets the click actually reach our own "place is missing" check.
    await page.locator('input[type="date"]').fill("1995-06-10");
    await page.getByRole("button", { name: /Generate my chart/ }).click();
    await expect(page.getByText(/Pick a birth date and a place/)).toBeVisible();
  });

  test("searching a place shows results to pick from", async ({ page }) => {
    await page.getByPlaceholder("City, country").fill("Amsterdam");
    await page.getByRole("button", { name: "Search" }).click();
    await expect(page.getByText(/Amsterdam, North Holland, Netherlands/)).toBeVisible();
  });

  test("completing the form generates a chart and redirects home", async ({ page }) => {
    await page.locator('input[type="date"]').fill("1995-06-10");
    await page.locator('input[type="time"]').fill("08:15");

    await page.getByPlaceholder("City, country").fill("Amsterdam");
    await page.getByRole("button", { name: "Search" }).click();
    await page.getByText(/Amsterdam, North Holland, Netherlands/).click();
    await expect(page.getByText(/Selected: Amsterdam/)).toBeVisible();

    await mockProfile(page, {
      user_id: "11111111-1111-1111-1111-111111111111",
      birth_place: "Amsterdam, Netherlands",
      natal_chart: FAKE_CHART,
    });

    await page.getByRole("button", { name: /Generate my chart/ }).click();
    await expect(page.getByText(/Saved — redirecting/)).toBeVisible();
    await page.waitForURL("**/", { timeout: 5000 });
  });
});

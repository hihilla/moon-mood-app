import { test, expect } from "@playwright/test";
import { mockSignIn, mockProfile, mockEntries } from "./mocks";

async function signIn(page) {
  await page.goto("/");
  await page.getByPlaceholder("Email").fill("alex@example.com");
  await page.getByPlaceholder("Password").fill("correct-horse-battery-staple");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("personal moon & mood log")).toBeVisible();
}

test.describe("today tab", () => {
  test.beforeEach(async ({ page }) => {
    await mockSignIn(page);
    await mockProfile(page, null);
    await mockEntries(page, []);
  });

  test("shows today's moon phase and sign", async ({ page }) => {
    await signIn(page);
    // e.g. "Waning Gibbous in Scorpio" — exact values are date-dependent,
    // so match against all eight possible phase names rather than a
    // specific one.
    const phasePattern =
      /(New Moon|Waxing Crescent|First Quarter|Waxing Gibbous|Full Moon|Waning Gibbous|Last Quarter|Waning Crescent) in .+/;
    await expect(page.getByText(phasePattern)).toBeVisible();
  });

  test("selecting mood tags and saving shows a confirmation", async ({ page }) => {
    await signIn(page);

    await page.getByText("Happy").click();
    await page.getByText("Grateful").click();
    await page.getByPlaceholder("Anything that happened today…").fill("Good day, got a lot done.");
    await page.getByRole("button", { name: /Save today's entry/ }).click();

    await expect(page.getByText("Saved")).toBeVisible();
  });

  test("mood pills toggle visually when clicked", async ({ page }) => {
    await signIn(page);
    const happy = page.getByText("Happy", { exact: true });
    await happy.click();
    // active pills render with a solid (non-transparent) background — the
    // component swaps `background` from "transparent" to the accent color
    await expect(happy).not.toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  });

  test("can switch to the Upcoming tab and see 28 days listed", async ({ page }) => {
    await signIn(page);
    await page.getByRole("button", { name: "Upcoming" }).click();
    // Each upcoming row renders "<phase> · <sign>" — the "·" only appears
    // once per row, unlike a weekday-abbreviation match, which also caught
    // the page header's full date (e.g. "Monday" contains "Mon").
    const rows = page.locator("text=/·/");
    await expect(rows).toHaveCount(28);
  });

  test("Insights tab explains there's nothing to show yet", async ({ page }) => {
    await signIn(page);
    await page.getByRole("button", { name: "Insights" }).click();
    await expect(page.getByText(/Log a period day to start tracking/)).toBeVisible();
  });
});

test.describe("log tab with existing entries", () => {
  test("renders a past entry with its tags", async ({ page }) => {
    await mockSignIn(page);
    await mockProfile(page, null);
    await mockEntries(page, [
      {
        entry_date: "2026-08-05",
        moods: ["Calm", "Tired"],
        energy: 2,
        period: true,
        cried: false,
        bloated: true,
        notes: "Slow day.",
      },
    ]);

    await signIn(page);
    await page.getByRole("button", { name: "Log" }).click();

    await expect(page.getByText("Calm, Tired")).toBeVisible();
    await expect(page.getByText("period")).toBeVisible();
    await expect(page.getByText("bloated")).toBeVisible();
    await expect(page.getByText("Slow day.")).toBeVisible();
  });
});

import { expect, test } from "@playwright/test";

test.describe("public smoke", () => {
  test("homepage renders core story and CTA", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", {
        name: "Turn production errors into fixes, ownership, and calmer releases."
      })
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Start trial" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Quickstart guide" })).toBeVisible();
  });

  test("pricing page renders plans", async ({ page }) => {
    await page.goto("/pricing");

    await expect(
      page.getByRole("heading", { name: "Simple pricing that scales with you." })
    ).toBeVisible();
    await expect(page.getByText("Start free, upgrade to Pro", { exact: false })).toBeVisible();
  });

  test("contact page renders support route", async ({ page }) => {
    await page.goto("/contact");

    await expect(
      page.getByRole("heading", { name: "Talk to the TraceForge team" })
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /Email support/i })).toBeVisible();
  });

  test("signin and signup forms render", async ({ page }) => {
    await page.goto("/signin");
    await expect(page.getByPlaceholder("Email")).toBeVisible();
    await expect(page.getByPlaceholder("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();

    await page.goto("/signup");
    await expect(page.getByPlaceholder("Full name")).toBeVisible();
    await expect(page.getByPlaceholder("Address")).toBeVisible();
    await expect(page.getByRole("button", { name: "Create account" })).toBeVisible();
  });
});

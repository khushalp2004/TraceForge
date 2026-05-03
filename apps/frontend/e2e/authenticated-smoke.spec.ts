import { expect, test } from "@playwright/test";
import { hasStandardCreds, login, standardCreds } from "./helpers/auth";

test.describe("authenticated smoke", () => {
  test.skip(
    !hasStandardCreds,
    "Set PLAYWRIGHT_TEST_EMAIL and PLAYWRIGHT_TEST_PASSWORD to run authenticated smoke tests."
  );

  test("user can sign in and reach the dashboard shell", async ({ page }) => {
    await login(page, standardCreds());

    await expect(page.getByText("Workspace").first()).toBeVisible();
    await expect(page.getByText("Overview").first()).toBeVisible();
  });

  test("billing page renders after login", async ({ page }) => {
    await login(page, standardCreds());

    await page.goto("/dashboard/billing");
    await expect(
      page.getByRole("heading", { name: "Personal and team plans" })
    ).toBeVisible();
  });

  test("projects and organizations pages render their primary actions", async ({ page }) => {
    await login(page, standardCreds());

    await page.goto("/dashboard/projects");
    await expect(page.getByRole("button", { name: /Create project/i }).first()).toBeVisible();

    await page.goto("/dashboard/orgs");
    await expect(page.getByRole("button", { name: /Create organization/i }).first()).toBeVisible();
  });
});

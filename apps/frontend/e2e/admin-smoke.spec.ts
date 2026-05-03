import { expect, test } from "@playwright/test";
import { adminCreds, hasAdminCreds, login } from "./helpers/auth";

test.describe("super admin smoke", () => {
  test.skip(
    !hasAdminCreds,
    "Set PLAYWRIGHT_ADMIN_EMAIL and PLAYWRIGHT_ADMIN_PASSWORD to run super admin smoke tests."
  );

  test("super admin dashboard renders platform controls", async ({ page }) => {
    await login(page, adminCreds());

    await page.goto("/dashboard/admin");
    await expect(
      page.getByRole("heading", { name: "Platform overview and user controls" })
    ).toBeVisible();
    await expect(page.getByText("Subscribers").first()).toBeVisible();
  });
});

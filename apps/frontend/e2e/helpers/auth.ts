import { expect, type Page } from "@playwright/test";

type Credentials = {
  email: string;
  password: string;
};

export const hasStandardCreds = Boolean(
  process.env.PLAYWRIGHT_TEST_EMAIL && process.env.PLAYWRIGHT_TEST_PASSWORD
);

export const hasAdminCreds = Boolean(
  process.env.PLAYWRIGHT_ADMIN_EMAIL && process.env.PLAYWRIGHT_ADMIN_PASSWORD
);

export const standardCreds = (): Credentials => ({
  email: process.env.PLAYWRIGHT_TEST_EMAIL || "",
  password: process.env.PLAYWRIGHT_TEST_PASSWORD || ""
});

export const adminCreds = (): Credentials => ({
  email: process.env.PLAYWRIGHT_ADMIN_EMAIL || "",
  password: process.env.PLAYWRIGHT_ADMIN_PASSWORD || ""
});

export async function login(page: Page, credentials: Credentials) {
  await page.goto("/signin");
  await page.getByPlaceholder("Email").fill(credentials.email);
  await page.getByPlaceholder("Password").fill(credentials.password);
  await page.getByRole("button", { name: "Sign in" }).click();

  await page.waitForURL(/\/dashboard/, { timeout: 20_000 });
  await expect(page).toHaveURL(/\/dashboard/);
}

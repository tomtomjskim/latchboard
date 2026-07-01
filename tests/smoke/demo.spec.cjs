const { expect, test } = require("@playwright/test");

test("demo server responds on loopback HTTP", async ({ page, request }) => {
  const response = await request.get("/");

  expect(response.status()).toBe(200);
  await expect(response.text()).resolves.toContain("Latchboard");

  await page.goto("/");

  await expect(page.getByText("Latchboard").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Attention Queue" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "All Workstreams" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Daily Summary" })).toBeVisible();
  await expect(page.getByText("Missing validation").first()).toBeVisible();
  await expect(page.getByText("Completion was claimed without a validation signal.").first()).toBeVisible();
  await expect(page.getByText("Run the planned validation and review the result.").first()).toBeVisible();
  await expect(page.getByText("Missing next step").first()).toBeVisible();
  await expect(page.getByText("Blocked").first()).toBeVisible();
  await expect(page.getByText("Stale").first()).toBeVisible();
});

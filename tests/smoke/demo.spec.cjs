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

  const snapshot = await page.evaluate(async () => {
    const token = window.__LATCHBOARD_BOOTSTRAP__.token;
    const response = await fetch("/api/snapshot", {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.json();
  });
  const attentionCounts = snapshot.attention.reduce((counts, row) => {
    const reason = row.classification.attentionReason;
    counts[reason] = (counts[reason] || 0) + 1;
    return counts;
  }, {});

  expect(attentionCounts).toEqual({
    missing_validation: 1,
    missing_next_step: 1,
    blocked: 1,
    stale: 1
  });
  expect(snapshot.workstreams.filter((row) => row.rawState === "verified_done")).toHaveLength(1);
  expect(snapshot.dailySummary).toEqual({ unresolved: 4, verifiedDone: 1, carryOver: 1 });
});

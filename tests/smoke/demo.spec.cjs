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

  const attentionPanel = page.locator("section.attention-panel");
  const attentionRows = attentionPanel.locator(".queue-row");
  const allWorkstreamsPanel = page.locator("section.workstream-panel");
  const allWorkstreamsList = page.getByRole("list", { name: "All workstreams" });
  const dailySummary = page.getByLabel("Daily summary");

  await expect(attentionRows).toHaveCount(4);
  await expect(allWorkstreamsList.getByRole("listitem")).toHaveCount(5);
  await expect(attentionPanel.locator(".section-heading")).toContainText("4 open");
  await expect(allWorkstreamsPanel.locator(".section-heading")).toContainText("5 observed");
  await expect(page.getByLabel("Today status")).toContainText("Attention 4");
  await expect(dailySummary.locator(".summary-grid > div").filter({ hasText: "Unresolved" })).toHaveText(
    /^Unresolved\s*4$/
  );
  await expect(dailySummary.locator(".summary-grid > div").filter({ hasText: "Verified" })).toHaveText(
    /^Verified\s*1$/
  );
  await expect(dailySummary.locator(".summary-grid > div").filter({ hasText: "Carry-over" })).toHaveText(
    /^Carry-over\s*1$/
  );

  await expect(attentionPanel.getByRole("button", { name: "View Workstream 5 details" })).toHaveCount(0);
  const verifiedWorkstream = allWorkstreamsList.getByRole("button", { name: "View Workstream 5 details" });
  await expect(verifiedWorkstream).toContainText("verified done");
  await expect(verifiedWorkstream).toContainText("Clear");
  await verifiedWorkstream.click();
  const workstreamDetail = page.getByLabel("Workstream detail");
  await expect(page.getByRole("heading", { name: "Workstream 5" })).toBeVisible();
  await expect(workstreamDetail).toContainText("No attention");
  await expect(workstreamDetail).toContainText("No next-step prompt is required.");

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

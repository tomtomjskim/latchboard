const { expect, test } = require("@playwright/test");

test("demo server responds on loopback HTTP", async ({ request }) => {
  const response = await request.get("/");

  expect(response.status()).toBe(200);
  await expect(response.text()).resolves.toContain("Latchboard");
});

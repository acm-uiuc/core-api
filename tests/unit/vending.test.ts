import { expect, test } from "vitest";
import init from "../../src/index.js";

const app = await init();
test("Test getting events", async () => {
  const response = await app.inject({
    method: "GET",
    url: "/api/v1/vending/items",
  });
  expect(response.statusCode).toBe(200);
});

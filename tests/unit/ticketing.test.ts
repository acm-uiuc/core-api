import { expect, test, vi } from "vitest";
import { DynamoDBClient, GetItemCommand } from "@aws-sdk/client-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import init from "../../src/index.js";
import { EventGetResponse } from "../../src/routes/events.js";
import { secretObject } from "./secret.testdata.js";
import {
  paidEventTableData,
  paidEventTableDataUnmarshalled,
} from "./data/mockTicketingData.testdata.js";

const ddbMock = mockClient(DynamoDBClient);
const jwt_secret = secretObject["jwt_key"];
vi.stubEnv("JwtSigningKey", jwt_secret);

const app = await init();
test("Test getting paid events", async () => {
  ddbMock.on(GetItemCommand).resolves({
    Item: paidEventTableData as any,
  });
  const response = await app.inject({
    method: "GET",
    url: "/api/v1/paidEvents/details/fa23_barcrawl",
  });
  expect(response.statusCode).toBe(200);
  const responseDataJson = (await response.json()) as EventGetResponse;
  expect(responseDataJson).toEqual(paidEventTableDataUnmarshalled);
});

test("Test dynamodb error handling", async () => {
  ddbMock.on(GetItemCommand).rejects("Could not get data.");
  const response = await app.inject({
    method: "GET",
    url: "/api/v1/paidEvents/details/fa23_barcrawl",
  });
  expect(response.statusCode).toBe(500);
  const responseDataJson = await response.json();
  expect(responseDataJson).toEqual({
    error: true,
    name: "DatabaseFetchError",
    id: 106,
    message: "Failed to get events from Dynamo table.",
  });
});

test("Test 404 on events that don't exist", async () => {
  ddbMock.on(GetItemCommand).resolves({
    Item: undefined,
  });
  const response = await app.inject({
    method: "GET",
    url: "/api/v1/paidEvents/details/fa23_barcrawl",
  });
  expect(response.statusCode).toBe(404);
  const responseDataJson = await response.json();
  expect(responseDataJson.id).toEqual(103);
});

test("Test 404 on events that are closed", async () => {
  ddbMock.on(GetItemCommand).resolves({
    Item: { ...paidEventTableData, event_sales_active_utc: { N: "-1" } },
  });
  const response = await app.inject({
    method: "GET",
    url: "/api/v1/paidEvents/details/fa23_barcrawl",
  });
  expect(response.statusCode).toBe(404);
  const responseDataJson = await response.json();
  expect(responseDataJson.id).toEqual(103);
});

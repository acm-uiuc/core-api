import { afterAll, expect, test, beforeEach, describe, vi } from "vitest";
import { ScanCommand, DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import init from "../../src/index.js";
import { EventGetResponse } from "../../src/routes/events.js";
import {
  dynamoTableData,
  dynamoTableDataUnmarshalled,
  dynamoTableDataUnmarshalledUpcomingOnly,
} from "./mockEventData.testdata.js";
import { secretObject } from "./secret.testdata.js";
import { FastifyInstance } from "fastify";
import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";

const ddbMock = mockClient(DynamoDBClient);
const smMock = mockClient(SecretsManagerClient);

// Setup mock environment variable for JWT secret
const jwt_secret = secretObject["jwt_key"];
vi.stubEnv("JwtSigningKey", jwt_secret);

// Global variable to hold the app instance
let app: FastifyInstance;

beforeEach(() => {
  // Reset mocks before each test
  ddbMock.reset();

  // Use fake timers
  vi.useFakeTimers();
});

afterAll(async () => {
  // Close the app after all tests are done
  if (app) {
    await app.close();
  }
  vi.useRealTimers();
});

describe("Event GET API Tests", () => {
  beforeEach(async () => {
    // Initialize the app within each describe block to ensure fresh setup
    smMock.reset();
    smMock.on(GetSecretValueCommand).resolves({
      SecretString: JSON.stringify(secretObject),
    });
    app = await init();
    await app.ready();
  });

  test("Test getting events", async () => {
    ddbMock.on(ScanCommand).resolves({
      Items: dynamoTableData as any,
    });
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/events",
    });
    expect(response.statusCode).toBe(200);
    const responseDataJson = (await response.json()) as EventGetResponse;
    expect(responseDataJson).toEqual(dynamoTableDataUnmarshalled);
  });

  test("Test dynamodb error handling", async () => {
    ddbMock.on(ScanCommand).rejects("Could not get data.");
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/events",
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

  test("Test upcoming only", async () => {
    const date = new Date(2024, 7, 10, 13, 0, 0); // 2024-08-10T17:00:00.000Z, don't ask me why its off a month
    vi.setSystemTime(date);
    ddbMock.on(ScanCommand).resolves({
      Items: dynamoTableData as any,
    });
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/events?upcomingOnly=true",
    });
    expect(response.statusCode).toBe(200);
    const responseDataJson = (await response.json()) as EventGetResponse;
    expect(responseDataJson).toEqual(dynamoTableDataUnmarshalledUpcomingOnly);
  });
});

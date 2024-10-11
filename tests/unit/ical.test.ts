import { afterAll, expect, test, beforeEach, describe, vi } from "vitest";
import { ScanCommand, DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import init from "../../src/index.js";
import { dynamoTableData } from "./mockEventData.testdata.js";
import { secretObject, secretJson } from "./secret.testdata.js";
import { readFile } from "fs/promises";
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
  smMock.reset();

  // Mock Secrets Manager responses
  smMock.on(GetSecretValueCommand).resolves({
    SecretString: JSON.stringify(secretObject),
  });

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

describe("iCal API Tests", () => {
  beforeEach(async () => {
    // Initialize the app within each describe block to ensure fresh setup
    app = await init();
    await app.ready();
  });

  test("Test getting ACM-wide iCal calendar", async () => {
    const date = new Date(2024, 7, 22, 15, 51, 48); // August 22, 2024, at 15:51:48 (3:51:48 PM)
    vi.setSystemTime(date);
    ddbMock.on(ScanCommand).resolves({
      Items: dynamoTableData as any,
    });
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/ical",
    });
    expect(response.statusCode).toBe(200);
    expect(response.headers["content-disposition"]).toEqual(
      'attachment; filename="calendar.ics"',
    );
    expect(response.body).toEqual(
      (await readFile("./tests/unit/data/acmWideCalendar.ics")).toString(),
    );
  });

  test("Test getting non-existent iCal calendar fails", async () => {
    const date = new Date(2024, 7, 22, 15, 51, 48); // August 22, 2024, at 15:51:48 (3:51:48 PM)
    vi.setSystemTime(date);
    ddbMock.on(ScanCommand).resolves({
      Items: dynamoTableData as any,
    });
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/ical/invalid",
    });
    expect(response.statusCode).toBe(400);
  });
});

import { afterAll, expect, test, beforeEach, describe, vi } from "vitest";
import { ScanCommand, DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import init from "../../src/index.js";
import { FastifyInstance } from "fastify";
import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
import { secretObject } from "./secret.testdata.js";

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

describe("Organizations API Test", () => {
  beforeEach(async () => {
    // Initialize the app within each describe block to ensure fresh setup
    app = await init();
    await app.ready();
  });

  test("Test getting the list of organizations succeeds", async () => {
    // Mock DynamoDB response for organizations
    ddbMock.on(ScanCommand).resolves({
      Items: [
        // Add mock organization data here if needed
      ],
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/organizations",
    });
    expect(response.statusCode).toBe(200);
    const responseDataJson = await response.json();
    // Add more specific expectations for the response data if needed
  });
});

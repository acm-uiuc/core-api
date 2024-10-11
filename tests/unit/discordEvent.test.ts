import { afterAll, expect, test, beforeEach, describe, vi, Mock } from "vitest";
import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import init from "../../src/index.js";
import { createJwt } from "./auth.test.js";
import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
import { secretJson, secretObject } from "./secret.testdata.js";
import supertest from "supertest";
import { FastifyInstance } from "fastify";
import { updateDiscord } from "../../src/functions/discord.js";

const ddbMock = mockClient(DynamoDBClient);
const smMock = mockClient(SecretsManagerClient);

// Setup mock environment variable for JWT secret
const jwt_secret = secretObject["jwt_key"];
vi.stubEnv("JwtSigningKey", jwt_secret);

// Mock the updateDiscord function
vi.mock("../../src/functions/discord.js", () => ({
  ...vi.importActual("../../src/functions/discord.js"),
  updateDiscord: vi.fn(() => {
    console.log("Updated discord event.");
  }),
}));

// Global variable to hold the app instance
let app: FastifyInstance;

beforeEach(() => {
  // Reset mocks before each test
  ddbMock.reset();
  smMock.reset();
  vi.resetAllMocks();

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

describe("Test Events <-> Discord integration", () => {
  beforeEach(async () => {
    // Initialize the app within each describe block to ensure fresh setup
    app = await init();
    await app.ready();
  });

  test("Happy path: valid publish submission.", async () => {
    ddbMock.on(PutItemCommand).resolves({});
    smMock.on(GetSecretValueCommand).resolves({
      SecretString: secretJson,
    });
    const testJwt = createJwt();
    const response = await supertest(app.server)
      .post("/api/v1/events")
      .set("authorization", `Bearer ${testJwt}`)
      .send({
        description: "Test paid event.",
        end: "2024-09-25T19:00:00",
        featured: true,
        host: "Social Committee",
        location: "Illini Union",
        start: "2024-09-25T18:00:00",
        title: "Fall Semiformal",
        paidEventId: "sp24_semiformal",
      });
    expect(response.statusCode).toBe(200);
    expect((updateDiscord as Mock).mock.calls.length).toBe(1);
  });

  test("Happy path: do not publish repeating events.", async () => {
    ddbMock.on(PutItemCommand).resolves({});
    smMock.on(GetSecretValueCommand).resolves({
      SecretString: secretJson,
    });
    const testJwt = createJwt();
    const response = await supertest(app.server)
      .post("/api/v1/events")
      .set("authorization", `Bearer ${testJwt}`)
      .send({
        description: "Test paid event.",
        end: "2024-09-25T19:00:00",
        featured: true,
        host: "Social Committee",
        location: "Illini Union",
        start: "2024-09-25T18:00:00",
        title: "Fall Semiformal",
        repeats: "weekly",
        paidEventId: "sp24_semiformal",
      });
    expect(response.statusCode).toBe(200);
    expect((updateDiscord as Mock).mock.calls.length).toBe(0);
  });

  // TODO: add discord reject test
});

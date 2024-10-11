import { afterAll, expect, test, beforeEach, describe } from "vitest";
import init from "../../src/index.js";
import { EventGetResponse } from "../../src/routes/events.js";
import { FastifyInstance } from "fastify";
import { mockClient } from "aws-sdk-client-mock";
import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
import { secretObject } from "./secret.testdata.js";

const smMock = mockClient(SecretsManagerClient);

// Global variable to hold the app instance
let app: FastifyInstance;

beforeEach(async () => {
  // Initialize the app before each test
  smMock.reset();
  smMock.on(GetSecretValueCommand).resolves({
    SecretString: JSON.stringify(secretObject),
  });
  app = await init();
  await app.ready();
});

afterAll(async () => {
  // Close the app after all tests are done
  if (app) {
    await app.close();
  }
});

describe("Health Check API Test", () => {
  test("Test getting health status", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/healthz",
    });
    expect(response.statusCode).toBe(200);
    const responseDataJson = (await response.json()) as EventGetResponse;
    expect(responseDataJson).toEqual({ message: "UP" });
  });
});

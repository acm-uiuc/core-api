import { afterAll, beforeEach, describe, expect, test, vi } from "vitest";
import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
import { mockClient } from "aws-sdk-client-mock";
import init from "../../src/index.js";
import { secretJson, secretObject, jwtPayload } from "./secret.testdata.js";
import jwt from "jsonwebtoken";
import { FastifyInstance } from "fastify";

// Mock the Secrets Manager client
const smMock = mockClient(SecretsManagerClient);
const jwt_secret = secretObject["jwt_key"];

// Utility function to create a JWT
export function createJwt(date?: Date, group?: string) {
  let modifiedPayload = { ...jwtPayload };
  if (date) {
    const nowMs = Math.floor(date.valueOf() / 1000);
    const laterMs = nowMs + 3600 * 24;
    modifiedPayload = {
      ...jwtPayload,
      iat: nowMs,
      nbf: nowMs,
      exp: laterMs,
    };
  }
  if (group) {
    modifiedPayload["groups"][0] = group;
  }
  return jwt.sign(modifiedPayload, jwt_secret, { algorithm: "HS256" });
}

// Stub environment variable for JWT signing key
vi.stubEnv("JwtSigningKey", jwt_secret);

// Global variable for the app instance
let app: FastifyInstance;

describe("Protected API Tests", () => {
  beforeEach(async () => {
    // Reset the mock and set up the Secrets Manager mock response
    smMock.reset();
    smMock.on(GetSecretValueCommand).resolves({
      SecretString: JSON.stringify(secretObject),
    });

    // Initialize the app before each test
    app = await init();
    await app.ready();
  });

  afterAll(async () => {
    // Close the app after all tests are complete
    if (app) {
      await app.close();
    }
  });

  test("Test happy path", async () => {
    const testJwt = createJwt();

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/protected",
      headers: {
        authorization: `Bearer ${testJwt}`,
      },
    });

    expect(response.statusCode).toBe(200);
    const jsonBody = await response.json();
    expect(jsonBody).toEqual({
      username: "infra-unit-test@acm.illinois.edu",
      roles: ["manage:events", "manage:links", "admin:links"],
    });
  });
});

import { expect, test } from "vitest";
import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
import { mockClient } from "aws-sdk-client-mock";
import init from "../../src/index.js";
import { secretJson, secretObject, jwtPayload } from "./secret.testdata.js";
import jwt from "jsonwebtoken";

const ddbMock = mockClient(SecretsManagerClient);

const app = await init();

function createJwt() {
  const jwt_secret = secretObject["jwt_key"];
  return jwt.sign(jwtPayload, jwt_secret, { algorithm: "HS256" });
}
const testJwt = createJwt();

test("Test happy path", async () => {
  ddbMock.on(GetSecretValueCommand).resolves({
    SecretString: secretJson,
  });
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
    roles: ["manage:events"],
  });
});

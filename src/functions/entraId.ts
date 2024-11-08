import { genericConfig } from "../config.js";
import { InternalServerError } from "../errors/index.js";
import { getSecretValue } from "../plugins/auth.js";
import { ConfidentialClientApplication } from "@azure/msal-node";
import { getItemFromCache, insertItemIntoCache } from "./cache.js";

export async function getEntraIdToken(
  clientId: string,
  scopes: string[] = ["https://graph.microsoft.com/.default"],
) {
  const secretApiConfig =
    (await getSecretValue(genericConfig.ConfigSecretName)) || {};
  if (
    !secretApiConfig.entra_id_private_key ||
    !secretApiConfig.entra_id_thumbprint
  ) {
    throw new InternalServerError({
      message: "Could not find Entra ID credentials.",
    });
  }
  const decodedPrivateKey = Buffer.from(
    secretApiConfig.entra_id_private_key as string,
    "base64",
  ).toString("utf8");
  const cachedToken = await getItemFromCache("entra_id_access_token");
  if (cachedToken) {
    return cachedToken["token"] as string;
  }
  const config = {
    auth: {
      clientId: clientId,
      authority: `https://login.microsoftonline.com/${genericConfig.EntraTenantId}`,
      clientCertificate: {
        thumbprint: (secretApiConfig.entra_id_thumbprint as string) || "",
        privateKey: decodedPrivateKey,
      },
      clientCapabilities: ["CP1"],
    },
  };
  const cca = new ConfidentialClientApplication(config);
  try {
    const result = await cca.acquireTokenByClientCredential({
      scopes,
    });
    const date = result?.expiresOn;
    if (!date) {
      throw new InternalServerError({
        message: `Failed to acquire token: token has no expiry field.`,
      });
    }
    date.setTime(date.getTime() - 30000);
    if (result?.accessToken) {
      await insertItemIntoCache(
        "entra_id_access_token",
        { token: result?.accessToken },
        date,
      );
    }
    return result?.accessToken ?? null;
  } catch (error) {
    throw new InternalServerError({
      message: `Failed to acquire token: ${error}`,
    });
  }
}

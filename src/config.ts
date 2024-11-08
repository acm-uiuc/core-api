import { allAppRoles, AppRoles, RunEnvironment } from "./roles.js";
import { OriginFunction } from "@fastify/cors";

// From @fastify/cors
type ArrayOfValueOrArray<T> = Array<ValueOrArray<T>>;
type OriginType = string | boolean | RegExp;
type ValueOrArray<T> = T | ArrayOfValueOrArray<T>;

type GroupRoleMapping = Record<string, readonly AppRoles[]>;
type AzureRoleMapping = Record<string, readonly AppRoles[]>;

export type ConfigType = {
  GroupRoleMapping: GroupRoleMapping;
  AzureRoleMapping: AzureRoleMapping;
  ValidCorsOrigins: ValueOrArray<OriginType> | OriginFunction;
  AadValidClientId: string;
};

type GenericConfigType = {
  EventsDynamoTableName: string;
  CacheDynamoTableName: string;
  ConfigSecretName: string;
  UpcomingEventThresholdSeconds: number;
  AwsRegion: string;
  EntraTenantId: string;
};

type EnvironmentConfigType = {
  [env in RunEnvironment]: ConfigType;
};

const genericConfig: GenericConfigType = {
  EventsDynamoTableName: "infra-core-api-events",
  CacheDynamoTableName: "infra-core-api-cache",
  ConfigSecretName: "infra-core-api-config",
  UpcomingEventThresholdSeconds: 1800, // 30 mins
  AwsRegion: process.env.AWS_REGION || "us-east-1",
  EntraTenantId: "c8d9148f-9a59-4db3-827d-42ea0c2b6e2e",
} as const;

const environmentConfig: EnvironmentConfigType = {
  dev: {
    GroupRoleMapping: {
      "48591dbc-cdcb-4544-9f63-e6b92b067e33": allAppRoles, // Infra Chairs
      "940e4f9e-6891-4e28-9e29-148798495cdb": allAppRoles, // ACM Infra Team
      "f8dfc4cf-456b-4da3-9053-f7fdeda5d5d6": allAppRoles, // Infra Leads
      "0": allAppRoles, // Dummy Group for development only
      "1": [], // Dummy Group for development only
    },
    AzureRoleMapping: { AutonomousWriters: [AppRoles.EVENTS_MANAGER] },
    ValidCorsOrigins: [
      "http://localhost:3000",
      "http://localhost:5173",
      "http://localhost:5174",
      "https://merch-pwa.pages.dev",
      "https://manage.qa.acmuiuc.org",
      /^https:\/\/(?:.*\.)?acmuiuc\.pages\.dev$/,
    ],
    AadValidClientId: "39c28870-94e4-47ee-b4fb-affe0bf96c9f",
  },
  prod: {
    GroupRoleMapping: {
      "48591dbc-cdcb-4544-9f63-e6b92b067e33": allAppRoles, // Infra Chairs
      "ff49e948-4587-416b-8224-65147540d5fc": allAppRoles, // Officers
      "ad81254b-4eeb-4c96-8191-3acdce9194b1": [AppRoles.EVENTS_MANAGER], // Exec
    },
    AzureRoleMapping: { AutonomousWriters: [AppRoles.EVENTS_MANAGER] },
    ValidCorsOrigins: [
      "https://acm.illinois.edu",
      "https://www.acm.illinois.edu",
      "https://manage.acm.illinois.edu",
      /^https:\/\/(?:.*\.)?acmuiuc\.pages\.dev$/,
    ],
    AadValidClientId: "5e08cf0f-53bb-4e09-9df2-e9bdc3467296",
  },
};

export type SecretConfig = {
  jwt_key?: string;
  discord_guild_id: string;
  discord_bot_token: string;
  entra_id_private_key: string;
  entra_id_thumbprint: string;
};

export { genericConfig, environmentConfig };

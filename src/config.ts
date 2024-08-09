import { AppRoles, RunEnvironment } from "./roles.js";

type GroupRoleMapping = Record<string, AppRoles[]>;
type AzureRoleMapping = Record<string, AppRoles[]>;

export type ConfigType = {
  GroupRoleMapping: GroupRoleMapping;
  AzureRoleMapping: AzureRoleMapping;
  ValidCorsOrigins: (string | RegExp)[];
  AadValidClientId: string;
};

type GenericConfigType = {
  DynamoTableName: string;
  ConfigSecretName: string;
  UpcomingEventThresholdSeconds: number;
  AwsRegion: string;
};

type EnvironmentConfigType = {
  [env in RunEnvironment]: ConfigType;
};

const genericConfig: GenericConfigType = {
  DynamoTableName: "infra-events-api-records",
  ConfigSecretName: "infra-events-api-config",
  UpcomingEventThresholdSeconds: 1800, // 30 mins
  AwsRegion: process.env.AWS_REGION || "us-east-1",
} as const;

const environmentConfig: EnvironmentConfigType = {
  dev: {
    GroupRoleMapping: {
      "48591dbc-cdcb-4544-9f63-e6b92b067e33": [AppRoles.MANAGER], // Infra Chairs
      "940e4f9e-6891-4e28-9e29-148798495cdb": [AppRoles.MANAGER], // ACM Infra Team
      "f8dfc4cf-456b-4da3-9053-f7fdeda5d5d6": [AppRoles.MANAGER], // Infra Leads
      "0": [AppRoles.MANAGER], // Dummy Group for development only
    },
    AzureRoleMapping: { AutonomousWriters: [AppRoles.MANAGER] },
    ValidCorsOrigins: [
      "http://localhost:3000",
      /^https:\/\/(?:.*\.)?acmuiuc\.pages\.dev$/,
    ],
    AadValidClientId: "39c28870-94e4-47ee-b4fb-affe0bf96c9f",
  },
  prod: {
    GroupRoleMapping: {
      "48591dbc-cdcb-4544-9f63-e6b92b067e33": [AppRoles.MANAGER], // Infra Chairs
      "ff49e948-4587-416b-8224-65147540d5fc": [AppRoles.MANAGER], // Officers
      "ad81254b-4eeb-4c96-8191-3acdce9194b1": [AppRoles.MANAGER], // Exec
    },
    AzureRoleMapping: { AutonomousWriters: [AppRoles.MANAGER] },
    ValidCorsOrigins: [
      "https://acm.illinois.edu",
      "https://www.acm.illinois.edu",
      /^https:\/\/(?:.*\.)?acmuiuc\.pages\.dev$/,
    ],
    AadValidClientId: "5e08cf0f-53bb-4e09-9df2-e9bdc3467296",
  },
} as const;

export { genericConfig, environmentConfig };

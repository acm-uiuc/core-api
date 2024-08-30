import { AppRoles, RunEnvironment } from "./roles.js";
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
  MembershipCheckEndpoint: string;
};

type GenericConfigType = {
  TicketingConfig: TicketingConfigType;
  DynamoTableName: string;
  CoreSecret: string;
  UpcomingEventThresholdSeconds: number;
  AwsRegion: string;
};

type TicketingConfigType = {
  TicketsTable: string;
  SecretName: string;
  EventsTable: string;
};
type EnvironmentConfigType = {
  [env in RunEnvironment]: ConfigType;
};

const genericConfig: GenericConfigType = {
  TicketingConfig: {
    SecretName: "infra-events-ticketing-config-secret",
    TicketsTable: "infra-events-tickets",
    EventsTable: "infra-events-ticketing-metadata",
  },
  DynamoTableName: "infra-core-api-events",
  CoreSecret: "infra-core-api-config",
  UpcomingEventThresholdSeconds: 1800, // 30 mins
  AwsRegion: process.env.AWS_REGION || "us-east-1",
} as const;

const environmentConfig: EnvironmentConfigType = {
  dev: {
    GroupRoleMapping: {
      "48591dbc-cdcb-4544-9f63-e6b92b067e33": [AppRoles.EVENTS_MANAGER], // Infra Chairs
      "940e4f9e-6891-4e28-9e29-148798495cdb": [AppRoles.EVENTS_MANAGER], // ACM Infra Team
      "f8dfc4cf-456b-4da3-9053-f7fdeda5d5d6": [AppRoles.EVENTS_MANAGER], // Infra Leads
      "0": [AppRoles.EVENTS_MANAGER], // Dummy Group for development only
      "1": [AppRoles.PUBLIC], // Dummy Group for development only
    },
    AzureRoleMapping: { AutonomousWriters: [AppRoles.EVENTS_MANAGER] },
    ValidCorsOrigins: [
      "http://localhost:3000",
      "http://localhost:5173",
      /^https:\/\/(?:.*\.)?acmuiuc\.pages\.dev$/,
    ],
    AadValidClientId: "39c28870-94e4-47ee-b4fb-affe0bf96c9f",
    MembershipCheckEndpoint:
      "https://infra-membership-api.aws.qa.acmuiuc.org/api/v1/checkMembership",
  },
  prod: {
    GroupRoleMapping: {
      "48591dbc-cdcb-4544-9f63-e6b92b067e33": [AppRoles.EVENTS_MANAGER], // Infra Chairs
      "ff49e948-4587-416b-8224-65147540d5fc": [AppRoles.EVENTS_MANAGER], // Officers
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
    MembershipCheckEndpoint:
      "https://infra-membership-api.aws.acmuiuc.org/api/v1/checkMembership",
  },
};

export { genericConfig, environmentConfig };

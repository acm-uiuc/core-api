/* eslint-disable import/prefer-default-export */
export const runEnvironments = ["dev", "prod"] as const;
export type RunEnvironment = (typeof runEnvironments)[number];
export enum AppRoles {
  EVENTS_MANAGER = "manage:events",
  SSO_INVITE_USER = "invite:sso",
}
export const allAppRoles = Object.values(AppRoles).filter(
  (value) => typeof value === "string",
);

/* eslint-disable import/prefer-default-export */
export const runEnvironments = ["dev", "prod"] as const;
export type RunEnvironment = (typeof runEnvironments)[number];
export enum AppRoles {
  EVENTS_MANAGER = "manage:events",
  LINKS_MANAGER = "manage:links",
  LINKS_ADMIN = "admin:links",
}
export const allAppRoles = Object.values(AppRoles).filter(
  (value) => typeof value === "string",
);

import { Sequelize } from "@sequelize/core";
import { PostgresDialect } from "@sequelize/postgres";
import { getSecretValue } from "../plugins/auth.js";
import { genericConfig } from "../config.js";
import { InternalServerError } from "../errors/index.js";
import { ShortLinkModel } from "../models/linkry.model.js";

let logDebug: CallableFunction = console.log;
let logFatal: CallableFunction = console.log;

// Function to set the current logger for each invocation
export function setSequelizeLogger(
  debugLogger: CallableFunction,
  fatalLogger: CallableFunction,
) {
  logDebug = (msg: string) => debugLogger(msg);
  logFatal = (msg: string) => fatalLogger(msg);
}

export async function getSequelizeInstance(): Promise<Sequelize> {
  let secret = null;
  if (!process.env.DATABASE_URL) {
    secret = await getSecretValue(genericConfig.ConfigSecretName);
    if (!secret) {
      throw new InternalServerError({
        message: "Invalid secret configuration",
      });
    }
  }

  const sequelize = new Sequelize({
    dialect: PostgresDialect,
    url: process.env.DATABASE_URL || secret?.postgres_url,
    ssl: {
      rejectUnauthorized: false,
    },
    models: [ShortLinkModel],
    logging: logDebug as (sql: string, timing?: number) => void,
    pool: {
      max: 2,
      min: 0,
      idle: 0,
      acquire: 3000,
      evict: 30, // lambda function timeout in seconds
    },
  });
  try {
    await sequelize.sync();
  } catch (e: unknown) {
    logFatal(`Could not authenticate to DB! ${e}`);
    throw new InternalServerError({
      message: "Could not establish database connection.",
    });
  }
  return sequelize;
}

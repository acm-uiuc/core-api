import { Sequelize } from "@sequelize/core";
import { PostgresDialect } from "@sequelize/postgres";
import { InternalServerError } from "../errors/index.js";
import { ShortLinkModel } from "../models/linkry.model.js";
import { FastifyInstance } from "fastify";
import SequelizeMock from "sequelize-mock";

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

export async function getSequelizeInstance(
  fastify: FastifyInstance,
): Promise<Sequelize> {
  // If in the test environment, return a mock Sequelize instance
  if (process.env.CI === "true") {
    const mockSequelize = new SequelizeMock();

    // Define a mock ShortLinkModel to simulate database behavior
    mockSequelize.define("ShortLink", {
      id: 1,
      name: "Mocked Link",
    });

    return mockSequelize;
  }

  // For non-test environments, initialize Sequelize with PostgreSQL
  const postgresUrl =
    process.env.DATABASE_URL || fastify.secretValue?.postgres_url || "";

  const sequelize = new Sequelize({
    dialect: PostgresDialect,
    url: postgresUrl as string,
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
      evict: 30, // Lambda function timeout in seconds
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

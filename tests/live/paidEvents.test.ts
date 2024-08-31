import { expect, test } from "vitest";
import { InternalServerError } from "../../src/errors/index.js";
import { EventsGetResponse } from "../../src/routes/events.js";
import { paidEventTableDataUnmarshalled } from "../unit/data/mockTicketingData.testdata.js";

const appKey = process.env.APPLICATION_KEY;
if (!appKey) {
  throw new InternalServerError({ message: "No application key found" });
}

const baseEndpoint = `https://${appKey}.aws.qa.acmuiuc.org`;

test("getting one paid event", async () => {
  const response = await fetch(
    `${baseEndpoint}/api/v1/paidEvents/details/fa23_barcrawl`,
  );
  expect(response.status).toBe(200);
  const responseJson = (await response.json()) as EventsGetResponse;
  expect(responseJson).toEqual(paidEventTableDataUnmarshalled);
});

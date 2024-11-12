import { unmarshall } from "@aws-sdk/util-dynamodb";
const fulfilledTicket1 = {
  ticket_id: {
    S: "975b4470cf37d7cf20fd404a711513fd1d1e68259ded27f10727d1384961843d",
  },
  event_id: {
    S: "fa23_barcrawl",
  },
  payment_method: {
    S: "stripe_autocreate",
  },
  purchase_time: {
    N: "1702347952",
  },
  scannerEmail: {
    S: "dsingh14@illinois.edu",
  },
  ticketholder_netid: {
    S: "dsingh14",
  },
  used: {
    BOOL: true,
  },
};
const unfulfilledTicket1 = {
  ticket_id: {
    S: "9d98e1e3c2138c93dd5a284239eddfa9c3037a0862972cd0f51ee1b54257a37e",
  },
  event_id: {
    S: "fa23_barcrawl",
  },
  payment_method: {
    S: "stripe_autocreate",
  },
  purchase_time: {
    N: "1702347952",
  },
  ticketholder_netid: {
    S: "dsingh14",
  },
  used: {
    BOOL: false,
  },
};
const unfulfilledTicket1WithEmail = {
  ticket_id: {
    S: "444ce3c3befe4a1f6b0ba940b8ff7dd91dda74e1a37ca8f5f16c8422a829d7f7",
  },
  event_id: {
    S: "fa22_barcrawl",
  },
  payment_method: {
    S: "stripe_autocreate",
  },
  purchase_time: {
    N: "1704347923",
  },
  ticketholder_netid: {
    S: "testinguser1@illinois.edu",
  },
  used: {
    BOOL: false,
  },
};

const dynamoTableData = [
  fulfilledTicket1,
  unfulfilledTicket1,
  unfulfilledTicket1WithEmail,
];

const dynamoTableDataUnmarshalled = dynamoTableData.map((x: any) => {
  const temp = unmarshall(x);
  delete temp.createdBy;
  return temp;
});

export {
  dynamoTableData,
  fulfilledTicket1,
  unfulfilledTicket1,
  unfulfilledTicket1WithEmail,
  dynamoTableDataUnmarshalled,
};

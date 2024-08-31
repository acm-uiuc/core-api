import { unmarshall } from "@aws-sdk/util-dynamodb";

const paidEventTableData = {
  event_id: {
    S: "fa23_barcrawl",
  },
  eventCost: {
    M: {
      others: {
        N: "18",
      },
      paid: {
        N: "15",
      },
    },
  },
  eventDetails: {
    S: "Join ACM and meet your fellow members as we visit KAMS, Joe's, and Legends on our semesterly bar crawl! Get a free t-shirt with sign-up! Alcohol will be provided by ACM to members over 21 wearing bar crawl t-shirts. We will also be hosting an official pregame (details released closer to the event)! This ticket does not pay for cover at the bars.",
  },
  eventImage: {
    S: "img/bar_crawl_fa23.png",
  },
  eventProps: {
    M: {
      dateLink: {
        S: "",
      },
      end: {
        N: "1699578000",
      },
      host: {
        S: "",
      },
      location: {
        S: "",
      },
      locationLink: {
        S: "",
      },
      repeats: {
        S: "",
      },
    },
  },
  event_capacity: {
    N: "130",
  },
  event_name: {
    S: "ACM Fall 2023 Bar Crawl",
  },
  event_sales_active_utc: {
    N: "0",
  },
  event_time: {
    N: "1699578000",
  },
  member_price: {
    S: "price_1O6zHhDiGOXU9RuSvlrcIfOv",
  },
  nonmember_price: {
    S: "price_1O6zHhDiGOXU9RuSvlrcIfOv",
  },
  tickets_sold: {
    N: "11",
  },
};

const paidEventTableDataUnmarshalled = unmarshall(paidEventTableData);
export { paidEventTableData, paidEventTableDataUnmarshalled };

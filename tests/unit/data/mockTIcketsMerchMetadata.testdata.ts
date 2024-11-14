const merchMetadata = [
  {
    item_id: {
      S: "2024_spr_tshirt",
    },
    item_email_desc: {
      S: "Please pick up your item in the ACM room on Wednesdays between 6pm and 6:30pm.",
    },
    item_image: {
      S: "img/tshirt.png",
    },
    item_name: {
      S: "ACM T-Shirt: Spring 2024 Series",
    },
    item_price: {
      M: {
        others: {
          N: "26",
        },
        paid: {
          N: "22",
        },
      },
    },
    item_sales_active_utc: {
      N: "0",
    },
    member_price: {
      S: "price_1OchTUDiGOXU9RuSQXnpbSHS",
    },
    nonmember_price: {
      S: "price_1OchTrDiGOXU9RuStYC6XgXp",
    },
    sizes: {
      L: [
        {
          S: "S",
        },
        {
          S: "M",
        },
        {
          S: "L",
        },
        {
          S: "XL",
        },
      ],
    },
    total_avail: {
      M: {
        L: {
          N: "10",
        },
        M: {
          N: "22",
        },
        S: {
          N: "23",
        },
        XL: {
          N: "9",
        },
      },
    },
  },
  {
    item_id: {
      S: "2024_fa_barcrawl",
    },
    item_email_desc: {
      S: "Shirts will be availiable for pickup one week before the event. Check your email near then for more details. Make sure to join the ACM Discord for updates!",
    },
    item_image: {
      S: "img/barcrawl_fa24_design.png",
    },
    item_name: {
      S: "ACM Bar Crawl: Fall 2024 (Nov 14)",
    },
    item_price: {
      M: {
        others: {
          N: "18",
        },
        paid: {
          N: "15",
        },
      },
    },
    item_sales_active_utc: {
      N: "0",
    },
    member_price: {
      S: "price_1QFSCiDiGOXU9RuSNJ90SblG",
    },
    nonmember_price: {
      S: "price_1QFSDVDiGOXU9RuSEUH0DQtx",
    },
    ready_for_pickup: {
      BOOL: false,
    },
    sizes: {
      L: [
        {
          S: "S",
        },
        {
          S: "M",
        },
        {
          S: "L",
        },
        {
          S: "XL",
        },
        {
          S: "2XL",
        },
      ],
    },
    total_avail: {
      M: {
        "2XL": {
          N: "2",
        },
        L: {
          N: "22",
        },
        M: {
          N: "0",
        },
        S: {
          N: "7",
        },
        XL: {
          N: "1",
        },
      },
    },
  },
];

const ticketsMetadata = [
  {
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
    event_capacity: {
      N: "130",
    },
    event_name: {
      S: "ACM Fall 2023 Bar Crawl",
    },
    event_sales_active_utc: {
      N: "-1",
    },
    event_time: {
      N: "1699578000",
    },
    member_price: {
      S: "price_1O6mXBDiGOXU9RuS2ZfBXaEc",
    },
    nonmember_price: {
      S: "price_1O6mXBDiGOXU9RuSq7PUcC1C",
    },
    tickets_sold: {
      N: "55",
    },
  },
  {
    event_id: {
      S: "fa22_barcrawl",
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
    event_capacity: {
      N: "130",
    },
    event_name: {
      S: "ACM Fall 2023 Bar Crawl",
    },
    event_sales_active_utc: {
      N: "-1",
    },
    event_time: {
      N: "1699578000",
    },
    member_price: {
      S: "price_1O6mXBDiGOXU9RuS2ZfBXaEc",
    },
    nonmember_price: {
      S: "price_1O6mXBDiGOXU9RuSq7PUcC1C",
    },
    tickets_sold: {
      N: "55",
    },
  },
];

export { merchMetadata, ticketsMetadata };

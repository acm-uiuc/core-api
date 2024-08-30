import {
  Client,
  GatewayIntentBits,
  Events,
  type GuildScheduledEventCreateOptions,
  GuildScheduledEventEntityType,
  GuildScheduledEventPrivacyLevel,
  GuildScheduledEvent,
  type GuildScheduledEventEditOptions,
  GuildScheduledEventStatus,
} from "discord.js";
import { EventPostRequest } from "./events.js";
import moment from "moment";

// https://stackoverflow.com/a/3809435/5684541
// https://calendar-buff.acmuiuc.pages.dev/calendar?id=dd7af73a-3df6-4e12-b228-0d2dac34fda7&date=2024-08-30
// https://www.acm.illinois.edu/calendar?id=dd7af73a-3df6-4e12-b228-0d2dac34fda7&date=2024-08-30

const urlRegex =
  /https:\/\/[a-f0-9\.-]+\/calendar\?id=([a-f0-9-]+)&date=[\d-]+/;
export const updateDiscord = async (
  event: EventPostRequest & { id: string },
  isDelete: boolean = false,
) => {
  // If an event isn't featured, don't create it.
  // If an event changed from featured to not featured, don't modify it.
  if (!isDelete && !event.featured) {
    return;
  }

  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  client.once(Events.ClientReady, async (readyClient: Client<true>) => {
    console.log(`Logged in as ${readyClient.user.tag}`);
    const guild = await client.guilds.fetch(
      process.env.DISCORD_SERVER_ID || "",
    );
    const discordEvents = await guild.scheduledEvents.fetch();
    const snowflakeMeetingLookup = discordEvents.reduce(
      (o, event) => {
        const { description } = event;
        // Find url in description using regex and extract the slug
        const url = (description || "").match(urlRegex);
        if (url) {
          const id = url[1];
          o[id] = event;
        }
        return o;
      },
      {} as Record<string, GuildScheduledEvent<GuildScheduledEventStatus>>,
    );

    console.log("snowflakeMeetingLookup", snowflakeMeetingLookup);

    const { title, description, start, end, location, host, id } = event;
    const existingMetadata = snowflakeMeetingLookup[id];

    if (isDelete) {
      if (existingMetadata) {
        await guild.scheduledEvents.delete(existingMetadata.id);
      } else {
        console.log(`Event with id ${id} not found in Discord`);
      }
      await client.destroy();
      return;
    }

    // Handle creation or update
    const date = moment(start).tz("America/Chicago").format("YYYY-MM-DD");
    const calendarURL = `https://www.acm.illinois.edu/calendar?id=${id}&date=${date}`;
    const fullDescription = `${calendarURL}\nHost: ${host}\n${description}`;
    const options: GuildScheduledEventCreateOptions = {
      entityType: GuildScheduledEventEntityType.External,
      privacyLevel: GuildScheduledEventPrivacyLevel.GuildOnly,
      name: title,
      description: fullDescription,
      scheduledStartTime: moment(start).tz("America/Chicago").toDate(),
      scheduledEndTime: end ?? moment(end).tz("America/Chicago").toDate(),
      entityMetadata: {
        location,
      },
    };

    if (existingMetadata) {
      const editOptions = {
        ...options,
        id: existingMetadata.id,
      };
      if (existingMetadata.creator?.bot !== true) {
        console.log(`Refusing to edit non-bot event "${title}"`);
      } else {
        await guild.scheduledEvents.edit(existingMetadata.id, editOptions);
      }
    } else {
      await guild.scheduledEvents.create(options);
    }

    await client.destroy();
  });

  client.login(process.env.DISCORD_TOKEN);
};
import {
  Client,
  GatewayIntentBits,
  Events,
  type GuildScheduledEventCreateOptions,
  GuildScheduledEventEntityType,
  GuildScheduledEventPrivacyLevel,
  GuildScheduledEvent,
  GuildScheduledEventStatus,
} from "discord.js";
import { type EventPostRequest } from "./events.js";
import moment from "moment";
import { getSecretValue } from "../plugins/auth.js";
import { FastifyRequest } from "fastify";

// https://stackoverflow.com/a/3809435/5684541
// https://calendar-buff.acmuiuc.pages.dev/calendar?id=dd7af73a-3df6-4e12-b228-0d2dac34fda7&date=2024-08-30
// https://www.acm.illinois.edu/calendar?id=dd7af73a-3df6-4e12-b228-0d2dac34fda7&date=2024-08-30

export type IUpdateDiscord = EventPostRequest & { id: string };

const urlRegex = /https:\/\/[a-z0-9\.-]+\/calendar\?id=([a-f0-9-]+)/;
export const updateDiscord = async (
  event: IUpdateDiscord,
  isDelete: boolean = false,
  request: FastifyRequest = {} as FastifyRequest,
) => {
  const log = request ? request.log.info : console.log;
  // If an event isn't featured or repeats, don't handle it.
  if (!isDelete && (!event.featured || event.repeats !== undefined)) {
    return;
  }

  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  client.once(Events.ClientReady, async (readyClient: Client<true>) => {
    console.log(`Logged in as ${readyClient.user.tag}`);
    const guildID = await getSecretValue("discord_guild_id");
    const guild = await client.guilds.fetch(guildID?.toString() || "");
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

    log("snowflakeMeetingLookup", snowflakeMeetingLookup);

    const { id } = event;

    const existingMetadata = snowflakeMeetingLookup[id];

    if (isDelete) {
      if (existingMetadata) {
        await guild.scheduledEvents.delete(existingMetadata.id);
      } else {
        log(`Event with id ${id} not found in Discord`);
      }
      await client.destroy();
      return;
    }

    // Handle creation or update
    const { title, description, start, end, location, host } = event;
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
        log(`Refusing to edit non-bot event "${title}"`);
      } else {
        await guild.scheduledEvents.edit(existingMetadata.id, editOptions);
      }
    } else {
      if (options.scheduledStartTime < new Date()) {
        log(`Refusing to create past event "${title}"`);
      } else {
        await guild.scheduledEvents.create(options);
      }
    }

    await client.destroy();
  });

  const token = await getSecretValue("discord_bot_token");
  client.login(token?.toString());
};

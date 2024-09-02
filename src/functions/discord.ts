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
import { type EventPostRequest } from "../routes/events.js";
import moment from "moment";
import { FastifyBaseLogger } from "fastify";
import { DiscordEventError } from "../errors/index.js";
import { getSecretValue } from "../plugins/auth.js";
import { genericConfig } from "../config.js";

// https://stackoverflow.com/a/3809435/5684541
// https://calendar-buff.acmuiuc.pages.dev/calendar?id=dd7af73a-3df6-4e12-b228-0d2dac34fda7&date=2024-08-30
// https://www.acm.illinois.edu/calendar?id=dd7af73a-3df6-4e12-b228-0d2dac34fda7&date=2024-08-30

export type IUpdateDiscord = EventPostRequest & { id: string };

const urlRegex = /https:\/\/[a-z0-9\.-]+\/calendar\?id=([a-f0-9-]+)/;
export const updateDiscord = async (
  event: IUpdateDiscord,
  isDelete: boolean = false,
  logger: FastifyBaseLogger,
): Promise<null | GuildScheduledEvent> => {
  const secretApiConfig =
    (await getSecretValue(genericConfig.ConfigSecretName)) || {};
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });

  client.once(Events.ClientReady, async (readyClient: Client<true>) => {
    logger.info(`Logged in as ${readyClient.user.tag}`);
    const guildID = secretApiConfig["discord_guild_id"];
    const guild = await client.guilds.fetch(guildID?.toString() || "");
    const discordEvents = await guild.scheduledEvents.fetch();
    const snowflakeMeetingLookup = discordEvents.reduce(
      (
        o: Record<string, GuildScheduledEvent<GuildScheduledEventStatus>>,
        event: GuildScheduledEvent<GuildScheduledEventStatus>,
      ) => {
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

    const { id } = event;

    const existingMetadata = snowflakeMeetingLookup[id];

    if (isDelete) {
      if (existingMetadata) {
        await guild.scheduledEvents.delete(existingMetadata.id);
      } else {
        logger.warn(`Event with id ${id} not found in Discord`);
      }
      await client.destroy();
      return null;
    }

    // Handle creation or update
    const { title, description, start, end, location, host } = event;
    const date = moment(start).tz("America/Chicago").format("YYYY-MM-DD");
    const calendarURL = `https://www.acm.illinois.edu/calendar?id=${id}&date=${date}`;
    const fullDescription = `${calendarURL}\n${description}`;
    const fullTitle = title.toLowerCase().includes(host.toLowerCase())
      ? title
      : `${host} - ${title}`;

    const options: GuildScheduledEventCreateOptions = {
      entityType: GuildScheduledEventEntityType.External,
      privacyLevel: GuildScheduledEventPrivacyLevel.GuildOnly,
      name: fullTitle,
      description: fullDescription,
      scheduledStartTime: moment(start).tz("America/Chicago").toDate(),
      scheduledEndTime: end && moment(end).tz("America/Chicago").toDate(),
      entityMetadata: {
        location,
      },
    };

    if (existingMetadata) {
      if (existingMetadata.creator?.bot !== true) {
        logger.warn(`Refusing to edit non-bot event "${title}"`);
      } else {
        await guild.scheduledEvents.edit(existingMetadata.id, options);
        return options;
      }
    } else {
      if (options.scheduledStartTime < new Date()) {
        logger.warn(`Refusing to create past event "${title}"`);
      } else {
        await guild.scheduledEvents.create(options);
        return options;
      }
    }

    await client.destroy();
  });

  const token = secretApiConfig["discord_bot_token"];

  if (!token) {
    logger.error("No Discord bot token found in secrets!");
    throw new DiscordEventError({});
  }

  client.login(token.toString());
  return null;
};
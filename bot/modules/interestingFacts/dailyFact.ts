import { EmbedBuilder, NewsChannel, TextChannel } from "discord.js";
import { funFactChannelId } from "../../config";
import { client } from "../../discord/client";
import { prisma } from "../../lib/prisma";

const TIME_ZONE = "Europe/Bratislava";
const DAY_MS = 24 * 60 * 60 * 1_000;
const GMT_PLUS_TWO_MS = 2 * 60 * 60 * 1_000;
const MAX_EMBED_DESCRIPTION_LENGTH = 4_096;

type ZonedDateTime = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function getZonedDateTime(date: Date): ZonedDateTime {
  const parts = dateFormatter.formatToParts(date);
  const values = new Map(parts.map(({ type, value }) => [type, Number(value)]));
  return {
    year: values.get("year")!,
    month: values.get("month")!,
    day: values.get("day")!,
    hour: values.get("hour")!,
    minute: values.get("minute")!,
    second: values.get("second")!,
  };
}

function getTimeZoneOffset(date: Date): number {
  const local = getZonedDateTime(date);
  const localAsUtc = Date.UTC(
    local.year,
    local.month - 1,
    local.day,
    local.hour,
    local.minute,
    local.second,
  );
  return localAsUtc - Math.floor(date.getTime() / 1_000) * 1_000;
}

function getNextNoon(now: Date): Date {
  const localNow = getZonedDateTime(now);
  let targetDate = new Date(
    Date.UTC(localNow.year, localNow.month - 1, localNow.day, 12),
  );

  const toInstant = (localDate: Date) => {
    const localNoonAsUtc = Date.UTC(
      localDate.getUTCFullYear(),
      localDate.getUTCMonth(),
      localDate.getUTCDate(),
      12,
    );
    return new Date(
      localNoonAsUtc - getTimeZoneOffset(new Date(localNoonAsUtc)),
    );
  };

  let target = toInstant(targetDate);
  if (target <= now) {
    targetDate = new Date(targetDate.getTime() + DAY_MS);
    target = toInstant(targetDate);
  }
  return target;
}

async function publishDailyFact(): Promise<void> {
  if (!funFactChannelId) {
    console.error("Fun fact posting is disabled; set DISCORD_FUN_FACT_CHANNEL_ID.");
    return;
  }

  const facts = await prisma.interestingFact.findMany({
    orderBy: [{ created_at: "asc" }, { id: "asc" }],
    select: { title: true, body: true, category: true },
  });
  if (facts.length === 0) {
    console.warn("No fun facts are saved; nothing will be posted today.");
    return;
  }

  const dayIndex = Math.floor((Date.now() + GMT_PLUS_TWO_MS) / DAY_MS);
  const fact = facts[dayIndex % facts.length];
  if (!fact) {
    throw new Error("Could not select today's fun fact.");
  }

  const channel = await client.channels.fetch(funFactChannelId);
  if (!(channel instanceof TextChannel || channel instanceof NewsChannel)) {
    throw new Error(
      `Fun fact channel ${funFactChannelId} does not exist or is not writable.`,
    );
  }

  const description = fact.body.slice(0, MAX_EMBED_DESCRIPTION_LENGTH);
  const embeds = [
    new EmbedBuilder()
      .setColor(0x8b5cf6)
      .setTitle(fact.title)
      .setDescription(description)
      .setFooter({
        text: fact.category
          ? `Fun fact of the day · ${fact.category}`
          : "Fun fact of the day",
      }),
  ];
  if (fact.body.length > MAX_EMBED_DESCRIPTION_LENGTH) {
    embeds.push(
      new EmbedBuilder()
        .setColor(0x8b5cf6)
        .setDescription(fact.body.slice(MAX_EMBED_DESCRIPTION_LENGTH)),
    );
  }

  await channel.send({ embeds });
  console.log(`Posted today's fun fact to Discord channel ${funFactChannelId}.`);
}

export function scheduleDailyFact(): void {
  if (!funFactChannelId) {
    console.error("Fun fact posting is disabled; set DISCORD_FUN_FACT_CHANNEL_ID.");
    return;
  }

  const nextNoon = getNextNoon(new Date());
  const delay = nextNoon.getTime() - Date.now();
  console.log(
    `Next fun fact will be posted at ${nextNoon.toLocaleString("en-GB", {
      timeZone: TIME_ZONE,
      dateStyle: "medium",
      timeStyle: "short",
    })} (${TIME_ZONE}).`,
  );

  setTimeout(() => {
    scheduleDailyFact();
    void publishDailyFact().catch((error: unknown) => {
      console.error("Could not post today's fun fact:", error);
    });
  }, delay);
}

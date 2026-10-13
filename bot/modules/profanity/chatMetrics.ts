import { Prisma } from "@prisma/client";
import type { Message } from "discord.js";
import { prisma } from "../../lib/prisma";
import { analyzeVulgarisms } from "./detector";

export async function recordMessageProfanity(message: Message): Promise<void> {
  const analysis = analyzeVulgarisms(message.content);
  if (analysis.occurrences === 0) return;

  try {
    const sourceEventId = `discord:${message.id}`;
    const displayName =
      message.author.globalName ?? message.author.username ?? message.author.id;
    await prisma.$transaction(async (tx) => {
      await tx.streamerBotChatMetricEvent.create({
        data: {
          source_event_id: sourceEventId,
          platform: "discord",
          provider_user_id: message.author.id,
          display_name: displayName,
          profanity_count: analysis.occurrences,
          message_count: 1,
        },
      });
      await tx.profanityCategoryEvent.createMany({
        data: Object.entries(analysis.categories).map(([category, score]) => ({
          source_event_id: sourceEventId,
          platform: "discord",
          provider_user_id: message.author.id,
          display_name: displayName,
          category,
          occurrence_count: score.occurrences,
          weighted_score: score.score,
        })),
      });
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return;
    }
    throw error;
  }
}

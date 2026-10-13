-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('twitch', 'discord');

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "spotify_rt" TEXT,
    "twitch_rt" TEXT,
    "discord_rt" TEXT,
    "spotify_at" TEXT,
    "twitch_at" TEXT,
    "discord_at" TEXT,
    "twitch_exp" TIMESTAMP(3),
    "spotify_exp" TIMESTAMP(3),
    "discord_exp" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Entity" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "twitch_id" TEXT,
    "discord_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Entity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TwitchEntity" (
    "id" SERIAL NOT NULL,
    "twitch_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TwitchEntity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TwitchStatistic" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "TwitchStatistic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TwitchStatisticEvent" (
    "id" SERIAL NOT NULL,
    "twitchEntityId" INTEGER NOT NULL,
    "statisticId" INTEGER NOT NULL,
    "value" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "season" TEXT,

    CONSTRAINT "TwitchStatisticEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscordEntity" (
    "id" SERIAL NOT NULL,
    "discord_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiscordEntity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscordStatistic" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "DiscordStatistic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscordStatisticEvent" (
    "id" SERIAL NOT NULL,
    "discordEntityId" INTEGER NOT NULL,
    "statisticId" INTEGER NOT NULL,
    "value" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "season" TEXT,

    CONSTRAINT "DiscordStatisticEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Entity_name_key" ON "Entity"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Entity_twitch_id_key" ON "Entity"("twitch_id");

-- CreateIndex
CREATE UNIQUE INDEX "Entity_discord_id_key" ON "Entity"("discord_id");

-- CreateIndex
CREATE UNIQUE INDEX "TwitchEntity_twitch_id_key" ON "TwitchEntity"("twitch_id");

-- CreateIndex
CREATE INDEX "TwitchStatisticEvent_twitchEntityId_idx" ON "TwitchStatisticEvent"("twitchEntityId");

-- CreateIndex
CREATE INDEX "TwitchStatisticEvent_statisticId_idx" ON "TwitchStatisticEvent"("statisticId");

-- CreateIndex
CREATE INDEX "TwitchStatisticEvent_created_at_idx" ON "TwitchStatisticEvent"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "DiscordEntity_discord_id_key" ON "DiscordEntity"("discord_id");

-- CreateIndex
CREATE INDEX "DiscordStatisticEvent_discordEntityId_idx" ON "DiscordStatisticEvent"("discordEntityId");

-- CreateIndex
CREATE INDEX "DiscordStatisticEvent_statisticId_idx" ON "DiscordStatisticEvent"("statisticId");

-- CreateIndex
CREATE INDEX "DiscordStatisticEvent_created_at_idx" ON "DiscordStatisticEvent"("created_at");

-- AddForeignKey
ALTER TABLE "TwitchStatisticEvent" ADD CONSTRAINT "TwitchStatisticEvent_twitchEntityId_fkey" FOREIGN KEY ("twitchEntityId") REFERENCES "TwitchEntity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TwitchStatisticEvent" ADD CONSTRAINT "TwitchStatisticEvent_statisticId_fkey" FOREIGN KEY ("statisticId") REFERENCES "TwitchStatistic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscordStatisticEvent" ADD CONSTRAINT "DiscordStatisticEvent_discordEntityId_fkey" FOREIGN KEY ("discordEntityId") REFERENCES "DiscordEntity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscordStatisticEvent" ADD CONSTRAINT "DiscordStatisticEvent_statisticId_fkey" FOREIGN KEY ("statisticId") REFERENCES "DiscordStatistic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

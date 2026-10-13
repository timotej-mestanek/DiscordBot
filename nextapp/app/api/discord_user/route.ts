import { getDiscordPoints } from "@/app/helpers/discord/points";
import { getCurrentAccount } from "@/lib/auth/session";
import { NextResponse } from "next/server";

export async function POST() {
  const account = await getCurrentAccount();
  if (!account) {
    return NextResponse.json({ error: "Přihlas se." }, { status: 401 });
  }
  const discordIdentity = account.identities.find(
    (identity) => identity.provider === "discord",
  );
  if (!discordIdentity) {
    return NextResponse.json(
      { error: "Nejdřív připoj Discord účet." },
      { status: 403 },
    );
  }

  const points = await getDiscordPoints(discordIdentity.provider_user_id);
  return NextResponse.json({ points });
}
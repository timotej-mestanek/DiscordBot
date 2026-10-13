import { NextResponse } from "next/server";
import { getCurrentAccount } from "@/lib/auth/session";
import { getAccountPointBalances } from "@/lib/points";

export async function GET() {
  const account = await getCurrentAccount();
  if (!account) {
    return NextResponse.json({ error: "Přihlas se." }, { status: 401 });
  }

  const balances = await getAccountPointBalances(account.identities);
  return NextResponse.json({
    ...balances,
    linked: {
      discord: balances.discord !== null,
      twitch: balances.twitchCustom !== null,
    },
  });
}

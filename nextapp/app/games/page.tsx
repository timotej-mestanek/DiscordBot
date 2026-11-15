import { getCurrentAccount } from "@/lib/auth/session";
import { getAccountPointBalances } from "@/lib/points";
import AppHeader from "@/app/AppHeader";
import GamesSection from "./GamesSection";

export const dynamic = "force-dynamic";

export default async function GamesPage() {
  const account = await getCurrentAccount();
  const balances = account
    ? await getAccountPointBalances(account.identities)
    : null;

  return (
    <main className="app-page games-page bg-zinc-950 text-white">
      <AppHeader account={account} section="games" />
      <div className="games-page-content">
        <GamesSection
          isLoggedIn={Boolean(account)}
          balances={
            balances
              ? {
                  discord: balances.discord,
                  twitch: balances.twitchCustom,
                }
              : null
          }
        />
      </div>
    </main>
  );
}

import { redirect } from "next/navigation";
import { getCurrentAccount } from "@/lib/auth/session";
import { getAccountPointBalances } from "@/lib/points";
import AppHeader from "@/app/AppHeader";
import StreamDeckPanel from "@/app/dashboard/remote/StreamDeckPanel";

export default async function RemoteDashboardPage() {
  const account = await getCurrentAccount();
  if (!account) redirect("/login");
  if (account.role !== "admin") redirect("/dashboard");
  const balances = await getAccountPointBalances(account.identities);

  return (
    <>
      <AppHeader
        account={account}
        balances={balances}
        adminView
        activeTab="remote"
      />
      <StreamDeckPanel />
    </>
  );
}

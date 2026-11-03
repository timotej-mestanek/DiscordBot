import { redirect } from "next/navigation";
import { getCurrentAccount } from "@/lib/auth/session";
import AppHeader from "@/app/AppHeader";
import StreamDeckPanel from "@/app/dashboard/remote/StreamDeckPanel";

export default async function RemoteDashboardPage() {
  const account = await getCurrentAccount();
  if (!account) redirect("/login");
  if (account.role !== "admin") redirect("/dashboard");
  return (
    <>
      <AppHeader account={account} adminView adminTab="remote" />
      <StreamDeckPanel />
    </>
  );
}

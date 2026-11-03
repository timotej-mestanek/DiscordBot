import { redirect } from "next/navigation";
import { getCurrentAccount } from "@/lib/auth/session";
import AppHeader from "@/app/AppHeader";
import AdminViewNotice from "@/app/AdminViewNotice";
import StreamDeckPanel from "@/app/dashboard/remote/StreamDeckPanel";

export default async function RemoteDashboardPage() {
  const account = await getCurrentAccount();
  if (!account) redirect("/login");
  if (account.role !== "admin") redirect("/dashboard");
  return (
    <>
      <AppHeader account={account} />
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 md:py-8">
        <AdminViewNotice adminView />
      </div>
      <StreamDeckPanel />
    </>
  );
}

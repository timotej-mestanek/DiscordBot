import { redirect } from "next/navigation";
import { getCurrentAccount } from "@/lib/auth/session";
import StreamDeckPanel from "@/app/dashboard/remote/StreamDeckPanel";

export default async function RemoteDashboardPage() {
  const account = await getCurrentAccount();
  if (!account) redirect("/login");
  if (account.role !== "admin") redirect("/dashboard");

  return <StreamDeckPanel />;
}

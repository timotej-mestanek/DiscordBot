import { redirect } from "next/navigation";
import { getCurrentAccount } from "@/lib/auth/session";

const loginProviders = [
  {
    name: "Discord",
    href: "/api/login/discord",
    className: "bg-[#5865F2] text-white hover:bg-[#4752C4]",
  },
  {
    name: "Twitch",
    href: "/api/login/twitch",
    className: "bg-[#9146FF] text-white hover:bg-[#772CE8]",
  },
];

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const account = await getCurrentAccount();
  if (account) redirect("/dashboard");

  const { error } = await searchParams;
  const errorMessage =
    error === "state"
      ? "Your sign-in session expired. Please try again."
      : error === "denied"
        ? "Sign-in was not completed."
        : error === "identity-in-use"
          ? "This account is already linked to another profile."
          : error === "provider"
            ? "The provider did not return a valid account. Please try signing in again."
            : null;

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 py-12 text-white">
      <section className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-8 shadow-2xl">
        <div className="mb-8 text-center">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-violet-400">
            N4JT
          </p>
          <h1 className="text-3xl font-bold tracking-tight">Sign in</h1>
          <p className="mt-3 text-sm leading-6 text-zinc-400">
            Sign in with Discord or Twitch. You can link the other account later in your dashboard.
          </p>
        </div>
        {errorMessage && (
          <p
            role="alert"
            className="mb-5 rounded-lg border border-red-900 bg-red-950/60 p-3 text-sm text-red-200"
          >
            {errorMessage}
          </p>
        )}
        <div className="grid gap-3">
          {loginProviders.map((provider) => (
            <a
              key={provider.name}
              href={provider.href}
              className={`flex min-h-12 items-center justify-center rounded-lg px-5 font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${provider.className}`}
            >
              Continue with {provider.name}
            </a>
          ))}
        </div>
        <p className="mt-6 text-center text-xs leading-5 text-zinc-500">
          By continuing, you allow the app to verify your account identity.
        </p>
      </section>
    </main>
  );
}
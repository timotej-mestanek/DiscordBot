import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentAccount } from "@/lib/auth/session";
import AppHeader from "@/app/AppHeader";

const loginProviders = [
  {
    name: "Discord",
    href: "/api/login/discord",
  },
  {
    name: "Twitch",
    href: "/api/login/twitch",
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
    <main className="app-page min-h-screen bg-zinc-950 text-white">
      <AppHeader account={null} section="account" />
      <div className="login-page">
        <section className="login-story">
          <div className="login-story-glow" aria-hidden="true" />
          <div className="login-story-copy">
            <p className="login-eyebrow"><span /> THE N4JT COMMUNITY</p>
            <h1>
              Your place
              <br />
              in the <span>stream.</span>
            </h1>
            <p className="login-story-description">
              Points, rewards, stream events and your community account —
              together in one place.
            </p>
            <div className="login-story-tags" aria-label="Community features">
              <span><i>01</i> Earn points</span>
              <span><i>02</i> Find rewards</span>
              <span><i>03</i> Join the stream</span>
            </div>
          </div>
          <div className="login-art" aria-hidden="true">
            <div className="login-art-orbit login-art-orbit-outer" />
            <div className="login-art-orbit login-art-orbit-inner" />
            <div className="login-art-core">N<span>4</span>JT</div>
            <div className="login-art-caption">STREAM · PLAY · REPEAT</div>
            <div className="login-art-spark login-art-spark-one">✦</div>
            <div className="login-art-spark login-art-spark-two">✧</div>
          </div>
          <p className="login-story-foot">N4JT<span> / </span>STREAM &amp; COMMUNITY</p>
        </section>
        <div className="login-access">
          <section className="login-card">
            <div className="login-card-heading">
              <span className="login-card-kicker">WELCOME BACK</span>
              <h2>Sign in to continue</h2>
              <p>Choose the account you use in the N4JT community.</p>
            </div>
            {errorMessage && (
              <p role="alert" className="login-error">{errorMessage}</p>
            )}
            <div className="login-provider-list">
              {loginProviders.map((provider) => (
                <a
                  key={provider.name}
                  href={provider.href}
                  className={`login-provider login-provider-${provider.name.toLowerCase()}`}
                >
                  <span className="login-provider-icon" aria-hidden="true">
                    {provider.name === "Discord" ? "D" : "T"}
                  </span>
                  <span>Continue with {provider.name}</span>
                  <span className="login-provider-arrow" aria-hidden="true">↗</span>
                </a>
              ))}
            </div>
            <div className="login-card-divider"><span>SECURE SIGN-IN</span></div>
            <p className="login-privacy">
              We only use your account to verify who you are. You can connect
              your other provider later from Authorization.
            </p>
            <Link href="/" className="login-back-link">
              <span aria-hidden="true">←</span> Back to the community
            </Link>
          </section>
          <p className="login-access-foot">By continuing, you agree to let N4JT verify your account identity.</p>
        </div>
      </div>
    </main>
  );
}
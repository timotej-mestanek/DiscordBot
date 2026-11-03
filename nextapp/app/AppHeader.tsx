import Link from "next/link";
import LivePointBalance from "@/app/LivePointBalance";

const accountLinks = [
  { tab: "points", label: "My Points" },
  { tab: "inventory", label: "Inventory" },
  { tab: "leds", label: "LEDs" },
  { tab: "auth", label: "Authorization" },
] as const;

const adminLinks = [
  { tab: "admin", label: "Stream settings" },
  { tab: "admin-shop", label: "Shop settings" },
  { tab: "wheels", label: "Wheels" },
  { tab: "overlays", label: "Overlays" },
  { tab: "interesting", label: "Fun facts" },
  { tab: "users", label: "Users" },
  { tab: "logs", label: "Logs" },
] as const;

type AppHeaderProps = {
  account: { display_name: string; role: string } | null;
  balances?: { discord: number | null; twitchCustom: number | null } | null;
  adminView?: boolean;
  activeTab?: string;
  showSignin?: boolean;
};

function MenuLink({
  href,
  children,
  active,
}: {
  href: string;
  children: React.ReactNode;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`app-nav-link${active ? " is-active" : ""}`}
      aria-current={active ? "page" : undefined}
    >
      {children}
    </Link>
  );
}

export default function AppHeader({
  account,
  balances,
  adminView = false,
  activeTab,
  showSignin = true,
}: AppHeaderProps) {
  const isAdmin = account?.role === "admin";

  return (
    <header className="app-header">
      <div className="app-header-row">
        <Link href="/" className="app-brand" aria-label="N4JT home">
          N4JT<span>.</span>
        </Link>
        <nav className="app-primary-nav" aria-label="Main navigation">
          <details className="app-menu">
            <summary className="app-menu-trigger">Menu</summary>
            <div className="app-menu-panel">
              {adminView && isAdmin ? (
                <section
                  className="app-menu-group"
                  aria-labelledby="admin-menu-heading"
                >
                  <h2 id="admin-menu-heading">Admin tools</h2>
                  <div className="app-menu-items app-menu-items-wide">
                    {adminLinks.map((item) => (
                      <MenuLink
                        key={item.tab}
                        href={`/dashboard?view=admin&tab=${item.tab}`}
                        active={activeTab === item.tab}
                      >
                        {item.label}
                      </MenuLink>
                    ))}
                    <MenuLink
                      href="/dashboard/remote"
                      active={activeTab === "remote"}
                    >
                      Stream Deck
                    </MenuLink>
                    <MenuLink
                      href="/admin/black-market"
                      active={activeTab === "black-market-admin"}
                    >
                      Black Market overview
                    </MenuLink>
                    <MenuLink href="/admin/black-market/crates">
                      Black Market crates
                    </MenuLink>
                    <MenuLink href="/admin/black-market/items">
                      Black Market items
                    </MenuLink>
                    <MenuLink href="/shop?view=admin">Shop products</MenuLink>
                  </div>
                </section>
              ) : (
                <div className="app-menu-groups">
                  <section
                    className="app-menu-group"
                    aria-labelledby="shop-menu-heading"
                  >
                    <h2 id="shop-menu-heading">Shop</h2>
                    <div className="app-menu-items">
                      <MenuLink href="/shop">Regular shop</MenuLink>
                      <MenuLink href="/black-market">Black Market</MenuLink>
                    </div>
                  </section>
                  {account && (
                    <section
                      className="app-menu-group"
                      aria-labelledby="account-menu-heading"
                    >
                      <h2 id="account-menu-heading">My account</h2>
                      <div className="app-menu-items">
                        {accountLinks.map((item) => (
                          <MenuLink
                            key={item.tab}
                            href={`/dashboard?view=user&tab=${item.tab}`}
                            active={activeTab === item.tab}
                          >
                            {item.label}
                          </MenuLink>
                        ))}
                      </div>
                    </section>
                  )}
                  <section
                    className="app-menu-group"
                    aria-labelledby="community-menu-heading"
                  >
                    <h2 id="community-menu-heading">Community</h2>
                    <div className="app-menu-items">
                      <MenuLink href="/commands">Commands</MenuLink>
                      <MenuLink href="/leaderboards">Leaderboards</MenuLink>
                    </div>
                  </section>
                </div>
              )}
            </div>
          </details>
        </nav>
        <div className="app-header-account">
          {account && balances && (
            <Link
              href="/dashboard?view=user&tab=points"
              className="app-points-pill"
              aria-label={`My points. Discord ${balances.discord?.toLocaleString("en-US") ?? "not linked"}; Twitch ${balances.twitchCustom?.toLocaleString("en-US") ?? "not linked"}`}
            >
              <span>POINTS</span>
              <LivePointBalance initial={balances} compact />
            </Link>
          )}
          {account ? (
            <>
              {isAdmin && (
                <Link
                  href={`/dashboard?view=${adminView ? "user" : "admin"}`}
                  className={`app-mode-toggle${adminView ? " is-admin" : ""}`}
                  aria-label={`Current mode: ${adminView ? "Admin" : "User"}. Switch to ${adminView ? "User" : "Admin"} view`}
                >
                  <span>{adminView ? "ADMIN MODE" : "USER MODE"}</span>
                  <strong>Switch to {adminView ? "user" : "admin"}</strong>
                </Link>
              )}
              <span className="app-account-name" title={account.display_name}>
                {account.display_name}
              </span>
              <form action="/api/logout" method="post">
                <button className="app-signout-button">Sign out</button>
              </form>
            </>
          ) : showSignin ? (
            <Link href="/login" className="app-signin-button">
              Sign in
            </Link>
          ) : null}
        </div>
      </div>
    </header>
  );
}

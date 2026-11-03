import Link from "next/link";
import LivePointBalance from "@/app/LivePointBalance";

const userLinks = [
  { tab: "points", label: "My points", detail: "Balances and conversions" },
  { tab: "inventory", label: "Inventory", detail: "Your shop items" },
  { tab: "leds", label: "LEDs", detail: "Create stream effects" },
  { tab: "auth", label: "Authorization", detail: "Connected accounts" },
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
  detail,
}: {
  href: string;
  children: React.ReactNode;
  active?: boolean;
  detail?: string;
}) {
  return (
    <Link
      href={href}
      className={`app-nav-link${active ? " is-active" : ""}`}
      aria-current={active ? "page" : undefined}
    >
      <span>{children}</span>
      {detail && <small>{detail}</small>}
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
        <div className="app-header-start">
          <Link href="/" className="app-brand" aria-label="N4JT home">
            <span className="app-brand-mark">N</span>
            <span className="app-brand-word">N4JT</span>
          </Link>
          <nav className="app-primary-nav" aria-label="Main navigation">
            <details className="app-menu">
              <summary className="app-menu-trigger">
                <span className="app-menu-icon" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
                <span>Explore</span>
                <span className="app-menu-chevron" aria-hidden="true">⌄</span>
              </summary>
              <div className="app-menu-panel">
                <div className="app-menu-heading">
                  <div>
                    <p>YOUR SPACE</p>
                    <h2>{adminView ? "Admin workspace" : "Community hub"}</h2>
                  </div>
                  <Link href="/" className="app-menu-home">
                    Home <span aria-hidden="true">↗</span>
                  </Link>
                </div>
                {adminView && isAdmin ? (
                  <div className="app-menu-admin">
                    <section className="app-menu-group">
                      <h3>Administration</h3>
                      <div className="app-menu-items">
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
                      </div>
                    </section>
                    <section className="app-menu-group">
                      <h3>Shop &amp; Black Market</h3>
                      <div className="app-menu-items">
                        <MenuLink href="/shop?view=admin">Shop products</MenuLink>
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
                      </div>
                    </section>
                  </div>
                ) : (
                  <div className="app-menu-content">
                    <section className="app-menu-group app-menu-shop">
                      <h3>Shop</h3>
                      <div className="app-menu-items">
                        <MenuLink href="/shop">
                          Regular shop <span aria-hidden="true">↗</span>
                        </MenuLink>
                        <MenuLink href="/black-market">
                          Black Market <span aria-hidden="true">↗</span>
                        </MenuLink>
                      </div>
                    </section>
                    {account && (
                      <section className="app-menu-group app-menu-user">
                        <h3>Your account</h3>
                        <div className="app-menu-items">
                          {userLinks.map((item) => (
                            <MenuLink
                              key={item.tab}
                              href={`/dashboard?view=user&tab=${item.tab}`}
                              active={activeTab === item.tab}
                              detail={item.detail}
                            >
                              {item.label}
                            </MenuLink>
                          ))}
                        </div>
                      </section>
                    )}
                    <section className="app-menu-group app-menu-community">
                      <h3>Community</h3>
                      <div className="app-menu-items">
                        <MenuLink href="/commands">Chat commands</MenuLink>
                        <MenuLink href="/leaderboards">Leaderboards</MenuLink>
                      </div>
                    </section>
                  </div>
                )}
              </div>
            </details>
          </nav>
        </div>

        <div className="app-header-account">
          {account && balances && (
            <Link
              href="/dashboard?view=user&tab=points"
              className="app-points-pill"
              aria-label={`My points. Discord ${balances.discord?.toLocaleString("en-US") ?? "not linked"}; Twitch ${balances.twitchCustom?.toLocaleString("en-US") ?? "not linked"}`}
            >
              <span className="app-points-icon" aria-hidden="true">✦</span>
              <span className="app-points-copy">
                <small>YOUR POINTS</small>
                <LivePointBalance initial={balances} compact />
              </span>
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
                  <span className="app-mode-dot" />
                  <span>{adminView ? "ADMIN" : "USER"}</span>
                  <strong>Switch view</strong>
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
              Sign in <span aria-hidden="true">↗</span>
            </Link>
          ) : null}
        </div>
      </div>
    </header>
  );
}

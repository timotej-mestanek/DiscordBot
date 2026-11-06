import Link from "next/link";

type AppHeaderProps = {
  account: { display_name: string; role: string } | null;
  section?: "shop" | "inventory" | "account";
  shopTab?: "default" | "blackmarket";
  adminView?: boolean;
  adminTab?: string;
};

const adminLinks = [
  { label: "Stream settings", href: "/dashboard?view=admin", tab: "admin" },
  { label: "Shop", href: "/shop?view=admin", tab: "shop" },
  { label: "Blackmarket", href: "/admin/black-market", tab: "blackmarket" },
  { label: "Users", href: "/dashboard?view=admin&tab=users", tab: "users" },
  { label: "Logs", href: "/dashboard?view=admin&tab=logs", tab: "logs" },
] as const;

const otherAdminLinks = [
  { label: "Overlays", href: "/dashboard?view=admin&tab=overlays", tab: "overlays" },
  { label: "Stream Deck", href: "/dashboard/remote", tab: "remote" },
  { label: "Account", href: "/dashboard?view=user&tab=account", tab: "account" },
  { label: "Fun facts", href: "/dashboard?view=admin&tab=interesting", tab: "interesting" },
  { label: "Wheels", href: "/dashboard?view=admin&tab=wheels", tab: "wheels" },
] as const;

function MainLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`app-main-link${active ? " is-active" : ""}`}
      aria-current={active ? "page" : undefined}
    >
      {children}
    </Link>
  );
}

export default function AppHeader({
  account,
  section,
  shopTab,
  adminView = false,
  adminTab,
}: AppHeaderProps) {
  const isAdmin = account?.role === "admin";

  return (
    <header className="app-header">
      <div className="app-header-row">
        <nav
          className={`app-main-nav${adminView && isAdmin ? " is-admin" : ""}`}
          aria-label={adminView && isAdmin ? "Admin navigation" : "Main navigation"}
        >
          {adminView && isAdmin ? (
            <>
              {adminLinks.map((item) => (
                <MainLink
                  key={item.label}
                  href={item.href}
                  active={adminTab === item.tab}
                >
                  {item.label}
                </MainLink>
              ))}
              <details
                className="app-admin-other"
                open={otherAdminLinks.some((item) => adminTab === item.tab)}
              >
                <summary
                  className={`app-main-link app-admin-other-trigger${
                    otherAdminLinks.some((item) => adminTab === item.tab)
                      ? " is-active"
                      : ""
                  }`}
                >
                  Other
                  <span aria-hidden="true">⌄</span>
                </summary>
                <div className="app-admin-other-menu">
                  {otherAdminLinks.map((item) => (
                    <MainLink
                      key={item.label}
                      href={item.href}
                      active={adminTab === item.tab}
                    >
                      {item.label}
                    </MainLink>
                  ))}
                </div>
              </details>
            </>
          ) : (
            <>
              <MainLink href="/shop" active={section === "shop"}>
                Shop
              </MainLink>
              {account && (
                <MainLink
                  href="/dashboard?view=user&tab=inventory"
                  active={section === "inventory"}
                >
                  Inventory
                </MainLink>
              )}
            <MainLink
              href={account ? "/dashboard?view=user&tab=account" : "/login"}
              active={section === "account"}
            >
              Account
            </MainLink>
            </>
          )}
        </nav>
        <div className="app-header-actions">
          {isAdmin && (
            <Link
              href={
                adminView
                  ? "/dashboard?view=user&tab=account"
                  : "/dashboard?view=admin"
              }
              className={`app-view-switch${adminView ? " is-admin" : ""}`}
            >
              {adminView ? "User view" : "Admin view"}
            </Link>
          )}
          {account && (
            <form action="/api/logout" method="post">
              <button className="app-signout-button" type="submit">
                Logout
              </button>
            </form>
          )}
        </div>
      </div>
      {shopTab && !(adminView && isAdmin) && (
        <nav className="app-shop-subnav" aria-label="Shop sections">
          <Link
            href="/shop"
            className={`app-shop-subnav-link${shopTab === "default" ? " is-active" : ""}`}
            aria-current={shopTab === "default" ? "page" : undefined}
          >
            Default shop
          </Link>
          <Link
            href="/black-market"
            className={`app-shop-subnav-link${shopTab === "blackmarket" ? " is-active" : ""}`}
            aria-current={shopTab === "blackmarket" ? "page" : undefined}
          >
            Blackmarket shop
          </Link>
        </nav>
      )}
    </header>
  );
}

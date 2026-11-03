import Link from "next/link";

type AppHeaderProps = {
  account: { display_name: string; role: string } | null;
  section?: "shop" | "inventory" | "account";
  shopTab?: "default" | "blackmarket";
};

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
}: AppHeaderProps) {
  return (
    <header className="app-header">
      <div className="app-header-row">
        <nav className="app-main-nav" aria-label="Main navigation">
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
        </nav>
        {account && (
          <form action="/api/logout" method="post">
            <button className="app-signout-button" type="submit">
              Logout
            </button>
          </form>
        )}
      </div>
      {shopTab && (
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

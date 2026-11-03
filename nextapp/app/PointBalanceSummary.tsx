type PointBalances = {
  discord: number | null;
  twitchCustom: number | null;
};

export default function PointBalanceSummary({
  balances,
  className = "",
}: {
  balances: PointBalances;
  className?: string;
}) {
  return (
    <div className={`app-point-balances ${className}`.trim()}>
      <div className="app-point-balance app-point-balance-discord">
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="app-point-balance-icon"
        >
          <path d="M19.73 5.12A18.2 18.2 0 0 0 15.2 3.7l-.56 1.14a16.7 16.7 0 0 0-5.28 0L8.8 3.7a18.2 18.2 0 0 0-4.53 1.42C1.4 9.35.62 13.48 1 17.55a18.3 18.3 0 0 0 5.56 2.82l1.2-1.95c-.66-.24-1.3-.55-1.9-.91l.46-.36a13 13 0 0 0 11.36 0l.46.36c-.6.36-1.24.67-1.9.91l1.2 1.95A18.3 18.3 0 0 0 23 17.55c.45-4.72-.76-8.81-3.27-12.43ZM8.95 14.76c-1.08 0-1.97-.99-1.97-2.2s.87-2.2 1.97-2.2c1.11 0 1.99 1 1.97 2.2 0 1.21-.87 2.2-1.97 2.2Zm6.1 0c-1.08 0-1.97-.99-1.97-2.2s.87-2.2 1.97-2.2c1.11 0 1.99 1 1.97 2.2 0 1.21-.86 2.2-1.97 2.2Z" />
        </svg>
        <span className="app-point-balance-label">Discord</span>
        <strong>
          {balances.discord?.toLocaleString("en-US") ?? "Not linked"}
          {balances.discord !== null && <small> pts</small>}
        </strong>
      </div>
      <div className="app-point-balance app-point-balance-twitch">
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="app-point-balance-icon"
        >
          <path d="M4.2 2 1 5.2v15.2h5.3V23h3.2l2.7-2.7h4.3L23 13.8V2H4.2Zm16.7 10.7-3.7 3.7h-5.1l-2.7 2.7v-2.7H5.1V3.9h15.8v8.8Z" />
          <path d="M15.2 6.6h1.9v5.6h-1.9zm-5.1 0H12v5.6h-1.9z" />
        </svg>
        <span className="app-point-balance-label">Twitch</span>
        <strong>
          {balances.twitchCustom?.toLocaleString("en-US") ?? "Not linked"}
          {balances.twitchCustom !== null && <small> pts</small>}
        </strong>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";

type Currency = "discord" | "twitch_custom";
type GameId = "coin" | "roulette" | "dice";
type RouletteColor = "red" | "black" | "green";
type Balances = { discord: number | null; twitch: number | null } | null;
type GameVisual =
  | { kind: "coin"; side: "heads" | "tails" }
  | { kind: "roulette"; number: number; color: RouletteColor }
  | { kind: "dice"; first: number; second: number; sum: number };
type GameResult = {
  win: boolean;
  payout: number;
  newBalance: number;
  message: string;
  visual: GameVisual;
};
type Selection =
  | { kind: "coin"; side: "heads" | "tails" }
  | { kind: "roulette-color"; color: RouletteColor }
  | { kind: "roulette-number"; number: number }
  | { kind: "dice-sum"; sum: number }
  | { kind: "dice-range"; min: number; max: number };

const gameItems: Array<{
  id: GameId;
  title: string;
  description: string;
}> = [
  {
    id: "coin",
    title: "Coin flip",
    description: "Heads or tails. Call it right and double your stake.",
  },
  {
    id: "roulette",
    title: "Roulette",
    description: "Place your bet, then watch the wheel settle.",
  },
  {
    id: "dice",
    title: "Dice roll",
    description: "Roll two dice and guess the total.",
  },
];

const rouletteNumbers = Array.from({ length: 37 }, (_, number) => number);
const diceValues = Array.from({ length: 11 }, (_, index) => index + 2);
const rouletteStrip = Array.from({ length: 3 }, () => rouletteNumbers).flat();
const redNumbers = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
]);
const dicePips: Record<number, Array<[number, number]>> = {
  1: [[50, 50]],
  2: [[28, 28], [72, 72]],
  3: [[28, 28], [50, 50], [72, 72]],
  4: [[28, 28], [72, 28], [28, 72], [72, 72]],
  5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
  6: [[28, 25], [72, 25], [28, 50], [72, 50], [28, 75], [72, 75]],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isGameVisual(value: unknown): value is GameVisual {
  if (!isRecord(value)) return false;
  if (
    value.kind === "coin" &&
    (value.side === "heads" || value.side === "tails")
  ) {
    return true;
  }
  if (
    value.kind === "roulette" &&
    typeof value.number === "number" &&
    Number.isInteger(value.number) &&
    value.number >= 0 &&
    value.number <= 36 &&
    (value.color === "red" || value.color === "black" || value.color === "green")
  ) {
    return true;
  }
  return (
    value.kind === "dice" &&
    typeof value.first === "number" &&
    Number.isInteger(value.first) &&
    value.first >= 1 &&
    value.first <= 6 &&
    typeof value.second === "number" &&
    Number.isInteger(value.second) &&
    value.second >= 1 &&
    value.second <= 6 &&
    value.sum === value.first + value.second
  );
}

function isGameResult(value: unknown): value is GameResult {
  return (
    isRecord(value) &&
    typeof value.win === "boolean" &&
    typeof value.payout === "number" &&
    Number.isSafeInteger(value.payout) &&
    typeof value.newBalance === "number" &&
    Number.isSafeInteger(value.newBalance) &&
    typeof value.message === "string" &&
    isGameVisual(value.visual)
  );
}

function GameGlyph({ game }: { game: GameId }) {
  if (game === "coin") {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <circle cx="16" cy="16" r="11.5" />
        <circle cx="16" cy="16" r="8" />
        <path d="M13 13.5c0-1.1.9-2 2-2h2m-4 9h2c1.1 0 2-.9 2-2s-.9-2-2-2h-1c-1.1 0-2-.9-2-2" />
      </svg>
    );
  }
  if (game === "roulette") {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <circle cx="16" cy="16" r="11.5" />
        <path d="M16 4.5v23M4.5 16h23M8 8l16 16M24 8 8 24" />
        <circle cx="16" cy="16" r="3" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <rect x="5.5" y="5.5" width="21" height="21" rx="5" />
      <circle cx="11" cy="11" r="1.5" />
      <circle cx="21" cy="11" r="1.5" />
      <circle cx="16" cy="16" r="1.5" />
      <circle cx="11" cy="21" r="1.5" />
      <circle cx="21" cy="21" r="1.5" />
    </svg>
  );
}

function DiceFace({ value }: { value: number }) {
  return (
    <svg viewBox="0 0 100 100" role="img" aria-label={`Die showing ${value}`}>
      <rect x="3" y="3" width="94" height="94" rx="18" />
      {dicePips[value].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="6.5" />
      ))}
    </svg>
  );
}

function FormSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="game-field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {children}
      </select>
    </label>
  );
}

function ResultPanel({
  result,
  onDismiss,
}: {
  result: { currency: Currency; data: GameResult };
  onDismiss: () => void;
}) {
  return (
    <section
      role="status"
      className={`game-result ${result.data.win ? "is-win" : "is-loss"}`}
      aria-live="polite"
    >
      <div className="game-result-mark" aria-hidden="true">
        {result.data.win ? "✓" : "×"}
      </div>
      <div className="game-result-copy">
        <p className="game-result-title">
          {result.data.win ? "Nice one — you won!" : "Not this time"}
        </p>
        <p className="game-result-message">{result.data.message}</p>
        <p className="game-result-points">
          Payout{" "}
          <strong>{result.data.payout.toLocaleString("en-US")} pts</strong>
          <span aria-hidden="true"> · </span>
          Balance{" "}
          <strong>
            {result.data.newBalance.toLocaleString("en-US")}{" "}
            {result.currency === "discord" ? "Discord" : "Twitch"} pts
          </strong>
        </p>
      </div>
      <button
        type="button"
        className="game-notice-close"
        aria-label="Dismiss game result"
        onClick={onDismiss}
      >
        ×
      </button>
    </section>
  );
}

export default function GamesSection({
  isLoggedIn,
  balances,
}: {
  isLoggedIn: boolean;
  balances: Balances;
}) {
  const [selectedGame, setSelectedGame] = useState<GameId>("coin");
  const [currency, setCurrency] = useState<Currency>(
    balances !== null && balances.discord !== null ? "discord" : "twitch_custom",
  );
  const [currentBalances, setCurrentBalances] = useState(balances);
  const [bets, setBets] = useState<Record<GameId, string>>({
    coin: "",
    roulette: "",
    dice: "",
  });
  const [coinSide, setCoinSide] = useState<"heads" | "tails">("heads");
  const [rouletteKind, setRouletteKind] = useState<"color" | "number">("color");
  const [rouletteColor, setRouletteColor] = useState<RouletteColor>("red");
  const [rouletteNumber, setRouletteNumber] = useState("17");
  const [diceKind, setDiceKind] = useState<"sum" | "range">("sum");
  const [diceSum, setDiceSum] = useState("7");
  const [diceMin, setDiceMin] = useState("6");
  const [diceMax, setDiceMax] = useState("8");
  const [loadingGame, setLoadingGame] = useState<GameId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<
    Record<GameId, { currency: Currency; data: GameResult } | null>
  >({ coin: null, roulette: null, dice: null });

  const balance =
    currentBalances?.[currency === "discord" ? "discord" : "twitch"] ?? null;
  const hasDiscord = currentBalances !== null && currentBalances.discord !== null;
  const hasTwitch = currentBalances !== null && currentBalances.twitch !== null;
  const activeGame = gameItems.find((item) => item.id === selectedGame)!;
  const result = results[selectedGame];
  const coinResult =
    result?.data.visual.kind === "coin" ? result.data.visual : null;
  const rouletteResult =
    result?.data.visual.kind === "roulette" ? result.data.visual : null;
  const diceResult =
    result?.data.visual.kind === "dice" ? result.data.visual : null;

  function getSelection(): Selection {
    if (selectedGame === "coin") {
      return { kind: "coin", side: coinSide };
    }
    if (selectedGame === "roulette") {
      return rouletteKind === "color"
        ? { kind: "roulette-color", color: rouletteColor }
        : { kind: "roulette-number", number: Number(rouletteNumber) };
    }
    return diceKind === "sum"
      ? { kind: "dice-sum", sum: Number(diceSum) }
      : { kind: "dice-range", min: Number(diceMin), max: Number(diceMax) };
  }

  async function play() {
    const amount = Number(bets[selectedGame]);
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      setError("Enter a positive whole-number bet.");
      return;
    }
    if (balance === null) {
      setError("Link the selected Twitch or Discord account before betting.");
      return;
    }
    if (amount > balance) {
      setError("Your bet cannot exceed your current balance.");
      return;
    }

    const game = selectedGame;
    setError(null);
    setResults((current) => ({ ...current, [game]: null }));
    setLoadingGame(game);
    try {
      const response = await fetch(`/api/games/${game}/play`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ currency, amount, selection: getSelection() }),
      });
      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        throw new Error("The server returned an invalid response.");
      }
      if (!response.ok) {
        const message =
          isRecord(payload) && typeof payload.error === "string"
            ? payload.error
            : "Could not play this game.";
        throw new Error(message);
      }
      if (!isGameResult(payload)) {
        throw new Error("The server returned an invalid game result.");
      }

      setCurrentBalances((current) =>
        current === null
          ? current
          : {
              ...current,
              [currency === "discord" ? "discord" : "twitch"]:
                payload.newBalance,
            },
      );
      setResults((current) => ({
        ...current,
        [game]: { currency, data: payload },
      }));
    } catch (playError) {
      setError(
        playError instanceof Error
          ? playError.message
          : "Could not play this game.",
      );
    } finally {
      setLoadingGame(null);
    }
  }

  if (!isLoggedIn) {
    return (
      <section className="game-login-gate">
        <div className="game-login-orb" aria-hidden="true" />
        <span className="game-eyebrow">N4JT ARCADE</span>
        <h1>Log in to play</h1>
        <p>Sign in to flip, roll, and bet Twitch or Discord points.</p>
        <Link href="/login">Log in to continue <span aria-hidden="true">↗</span></Link>
      </section>
    );
  }

  return (
    <div className="game-arcade">
      <aside className="game-sidebar" aria-label="Game selector">
        <div className="game-sidebar-heading">
          <span className="game-sidebar-spark" aria-hidden="true">✦</span>
          <div>
            <p>THE ARCADE</p>
            <h2>Pick a game</h2>
          </div>
        </div>
        <nav className="game-selector">
          {gameItems.map((game, index) => {
            const active = selectedGame === game.id;
            return (
              <button
                key={game.id}
                type="button"
                aria-current={active ? "page" : undefined}
                aria-pressed={active}
                disabled={loadingGame !== null}
                className={`game-selector-item${active ? " is-active" : ""}`}
                onClick={() => {
                  setSelectedGame(game.id);
                  setError(null);
                }}
              >
                <span className="game-selector-glyph">
                  <GameGlyph game={game.id} />
                </span>
                <span className="game-selector-copy">
                  <strong>{game.title}</strong>
                  <small>{game.description}</small>
                </span>
                <span className="game-selector-number">0{index + 1}</span>
              </button>
            );
          })}
          <button
            type="button"
            className="game-selector-item game-selector-teaser"
            disabled
          >
            <span className="game-selector-glyph game-teaser-glyph" aria-hidden="true">
              +
            </span>
            <span className="game-selector-copy">
              <strong>More games coming soon</strong>
              <small>Blackjack · Wheel · Crash</small>
            </span>
          </button>
        </nav>
        <div className="game-sidebar-foot">
          <span className="game-status-light" />
          <span>POINTS ONLY</span>
          <span className="game-sidebar-lock" aria-hidden="true">●</span>
        </div>
      </aside>

      <main className="game-main">
        <header className="game-page-header">
          <div>
            <span className="game-eyebrow">GAMES / {activeGame.title.toUpperCase()}</span>
            <h1>{activeGame.title}</h1>
          </div>
          <label className="game-wallet">
            <span>BETTING WITH</span>
            <select
              value={currency}
              onChange={(event) =>
                setCurrency(
                  event.target.value === "discord" ? "discord" : "twitch_custom",
                )
              }
            >
              <option value="discord" disabled={!hasDiscord}>
                Discord · {hasDiscord ? currentBalances?.discord?.toLocaleString("en-US") : "link account"}
              </option>
              <option value="twitch_custom" disabled={!hasTwitch}>
                Twitch · {hasTwitch ? currentBalances?.twitch?.toLocaleString("en-US") : "link account"}
              </option>
            </select>
          </label>
        </header>

        <section className={`game-table game-table--${selectedGame}`}>
          <div className="game-table-glow" aria-hidden="true" />
          <div className="game-table-topline">
            <span><i /> LIVE TABLE</span>
            <span className="game-table-odds">
              {selectedGame === "coin"
                ? "DOUBLE OR NOTHING"
                : selectedGame === "roulette"
                  ? "EUROPEAN ROULETTE"
                  : "TWO DICE · 2–12"}
            </span>
          </div>

          <div className="game-visual-stage">
            {selectedGame === "coin" && (
              <figure className="coin-stage">
                <div className="coin-aura" aria-hidden="true" />
                <div
                  className={[
                    "coin-body",
                    loadingGame === "coin"
                      ? "is-tossing"
                      : coinResult
                        ? `is-settling is-${coinResult.side}`
                        : `is-${coinSide}`,
                  ].join(" ")}
                >
                  <svg className="coin-face coin-face-front" viewBox="0 0 180 180" aria-hidden="true">
                    <circle cx="90" cy="90" r="83" fill="#9b641f" />
                    <circle cx="90" cy="90" r="76" fill="#e4b752" />
                    <circle cx="90" cy="90" r="65" fill="none" stroke="#ffe8a0" strokeWidth="2" />
                    <path d="M90 42v96m-19-71c0-8 7-14 15-14h14m-29 85h23c8 0 15-6 15-14s-7-15-15-15H86c-8 0-15-7-15-15" fill="none" stroke="#80501b" strokeLinecap="round" strokeWidth="8" />
                    <text x="90" y="159" textAnchor="middle">HEADS</text>
                  </svg>
                  <svg className="coin-face coin-face-back" viewBox="0 0 180 180" aria-hidden="true">
                    <circle cx="90" cy="90" r="83" fill="#9b641f" />
                    <circle cx="90" cy="90" r="76" fill="#e4b752" />
                    <circle cx="90" cy="90" r="65" fill="none" stroke="#ffe8a0" strokeWidth="2" />
                    <path d="M66 65c4-13 15-20 27-20 17 0 27 9 27 23 0 12-8 19-17 26l-11 9c-9 7-13 14-13 25v6m0 12v2" fill="none" stroke="#80501b" strokeLinecap="round" strokeWidth="9" />
                    <text x="90" y="159" textAnchor="middle">TAILS</text>
                  </svg>
                </div>
                <figcaption className="game-visual-caption">
                  {coinResult
                    ? `It landed ${coinResult.side}.`
                    : `Call it: ${coinSide}.`}
                </figcaption>
              </figure>
            )}

            {selectedGame === "roulette" && (
              <figure className="roulette-stage">
                <div className="roulette-display">
                  <span className="roulette-pointer" aria-hidden="true" />
                  <div className="roulette-window">
                    <div
                      key={rouletteResult ? `${rouletteResult.number}-${rouletteResult.color}` : loadingGame === "roulette" ? "rolling" : "idle"}
                      className={[
                        "roulette-track",
                        loadingGame === "roulette"
                          ? "is-rolling"
                          : rouletteResult
                            ? "is-settling"
                            : "is-idle",
                      ].join(" ")}
                      style={{
                        "--roulette-stop": `-${((37 + (rouletteResult?.number ?? 18)) * 64) + 28}px`,
                      } as CSSProperties}
                    >
                      {rouletteStrip.map((number, index) => (
                        <span
                          key={`${index}-${number}`}
                          className={`roulette-cell is-${number === 0 ? "green" : redNumbers.has(number) ? "red" : "black"}`}
                        >
                          {number}
                        </span>
                      ))}
                    </div>
                  </div>
                  <span className="roulette-center-line" aria-hidden="true" />
                </div>
                <figcaption className="game-visual-caption">
                  {rouletteResult
                    ? `The ball stopped on ${rouletteResult.number} · ${rouletteResult.color}.`
                    : "Place your bet and let it ride."}
                </figcaption>
              </figure>
            )}

            {selectedGame === "dice" && (
              <figure className="dice-stage">
                <div
                  className={`dice-pair${loadingGame === "dice" ? " is-rolling" : diceResult ? " is-settling" : ""}`}
                >
                  <div className="game-die"><DiceFace value={diceResult?.first ?? 3} /></div>
                  <span className="dice-plus" aria-hidden="true">+</span>
                  <div className="game-die game-die--second"><DiceFace value={diceResult?.second ?? 5} /></div>
                </div>
                <figcaption className="game-visual-caption">
                  {diceResult
                    ? `You rolled ${diceResult.first} + ${diceResult.second} = ${diceResult.sum}.`
                    : "Two dice. One roll."}
                </figcaption>
              </figure>
            )}
          </div>

          <form
            className="game-control-panel"
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              void play();
            }}
          >
            <div className="game-control-heading">
              <div>
                <span className="game-eyebrow">PLACE YOUR BET</span>
                <h2>{activeGame.description}</h2>
              </div>
              <span className="game-stake-note">POINTS · NO CASH</span>
            </div>

            {selectedGame === "coin" && (
              <div className="game-choice-row">
                <FormSelect
                  label="Your call"
                  value={coinSide}
                  onChange={(value) => setCoinSide(value === "tails" ? "tails" : "heads")}
                >
                  <option value="heads">Heads · 2× payout</option>
                  <option value="tails">Tails · 2× payout</option>
                </FormSelect>
                <p className="game-rule-copy">A correct call returns 2× your bet, including the stake.</p>
              </div>
            )}

            {selectedGame === "roulette" && (
              <div className="game-choice-row game-choice-row--roulette">
                <FormSelect
                  label="Bet type"
                  value={rouletteKind}
                  onChange={(value) => setRouletteKind(value === "number" ? "number" : "color")}
                >
                  <option value="color">Color</option>
                  <option value="number">Exact number</option>
                </FormSelect>
                {rouletteKind === "color" ? (
                  <FormSelect
                    label="Color"
                    value={rouletteColor}
                    onChange={(value) =>
                      setRouletteColor(
                        value === "black" || value === "green" ? value : "red",
                      )
                    }
                  >
                    <option value="red">Red · 2× payout</option>
                    <option value="black">Black · 2× payout</option>
                    <option value="green">Green · 36× payout</option>
                  </FormSelect>
                ) : (
                  <FormSelect
                    label="Number · 0–36"
                    value={rouletteNumber}
                    onChange={setRouletteNumber}
                  >
                    {rouletteNumbers.map((number) => (
                      <option key={number} value={number}>{number}</option>
                    ))}
                  </FormSelect>
                )}
              </div>
            )}

            {selectedGame === "dice" && (
              <div className="game-choice-row game-choice-row--dice">
                <FormSelect
                  label="Guess type"
                  value={diceKind}
                  onChange={(value) => setDiceKind(value === "range" ? "range" : "sum")}
                >
                  <option value="sum">Exact sum</option>
                  <option value="range">Sum range</option>
                </FormSelect>
                {diceKind === "sum" ? (
                  <FormSelect label="Sum · 2–12" value={diceSum} onChange={setDiceSum}>
                    {diceValues.map((value) => (
                      <option key={value} value={value}>{value}</option>
                    ))}
                  </FormSelect>
                ) : (
                  <>
                    <FormSelect label="From" value={diceMin} onChange={setDiceMin}>
                      {diceValues.map((value) => (
                        <option key={value} value={value}>{value}</option>
                      ))}
                    </FormSelect>
                    <FormSelect label="To" value={diceMax} onChange={setDiceMax}>
                      {diceValues.map((value) => (
                        <option key={value} value={value}>{value}</option>
                      ))}
                    </FormSelect>
                  </>
                )}
                <p className="game-rule-copy game-rule-copy--dice">
                  Gross payout = floor(36 ÷ matching combinations) × bet.
                </p>
              </div>
            )}

            <div className="game-bet-row">
              <label className="game-field game-bet-field">
                <span>Bet amount</span>
                <span className="game-bet-input-wrap">
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={balance ?? undefined}
                    step={1}
                    required
                    value={bets[selectedGame]}
                    onChange={(event) =>
                      setBets((current) => ({
                        ...current,
                        [selectedGame]: event.target.value,
                      }))
                    }
                    aria-label={`${activeGame.title} bet amount`}
                  />
                  <span>PTS</span>
                </span>
                <small>
                  Available{" "}
                  <strong>
                    {balance === null ? "—" : balance.toLocaleString("en-US")}
                  </strong>
                </small>
              </label>
              <button
                type="submit"
                className={`game-play-button${loadingGame === selectedGame ? " is-playing" : ""}`}
                disabled={loadingGame !== null || balance === null}
              >
                <span>{loadingGame === selectedGame ? "PLAYING" : "PLAY NOW"}</span>
                <strong>
                  {loadingGame === selectedGame
                    ? "..."
                    : selectedGame === "coin"
                      ? "FLIP COIN"
                      : selectedGame === "roulette"
                        ? "SPIN WHEEL"
                        : "ROLL DICE"}
                </strong>
                <span className="game-play-arrow" aria-hidden="true">↗</span>
              </button>
            </div>
          </form>
        </section>

        <p className="game-points-notice">
          <span aria-hidden="true">ⓘ</span>
          Bets use Twitch or Discord points only — no real money. Payouts include
          the returned stake and are credited to the selected balance.
        </p>
      </main>
      {(error || result || (!hasDiscord && !hasTwitch)) && (
        <div className="game-notifications">
          {error && (
            <div role="alert" className="game-error">
              <span aria-hidden="true">!</span>
              <p>{error}</p>
              <button
                type="button"
                className="game-notice-close"
                aria-label="Dismiss error"
                onClick={() => setError(null)}
              >
                ×
              </button>
            </div>
          )}
          {result && (
            <ResultPanel
              result={result}
              onDismiss={() =>
                setResults((current) => ({
                  ...current,
                  [selectedGame]: null,
                }))
              }
            />
          )}
          {!hasDiscord && !hasTwitch && (
            <div className="game-link-notice">
              Link a Twitch or Discord account to play.{" "}
              <Link href="/dashboard?view=user&tab=account">
                Manage linked accounts
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

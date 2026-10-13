import assert from "node:assert/strict";
import test from "node:test";
import { formatPlatformNickname } from "../discord/services/nickname";

test("nickname includes Twitch only when linked", () => {
  assert.equal(formatPlatformNickname("DOM"), "💬 DOM");
  assert.equal(formatPlatformNickname("DOM", "DOMCO"), "💬 DOM (🟣 DOMCO)");
});

test("nickname stays within Discord's 32 UTF-16-unit limit", () => {
  const longNickname = formatPlatformNickname(
    "Long Discord display name ".repeat(3),
    "Long Twitch display name ".repeat(3),
  );
  assert.ok(longNickname.length <= 32);
  assert.ok(longNickname.startsWith("💬 "));
});

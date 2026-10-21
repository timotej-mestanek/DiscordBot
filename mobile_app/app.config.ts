import type { ConfigContext, ExpoConfig } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "N4JT Stream Deck",
  slug: "n4jt-stream-deck",
  scheme: "n4jt-stream-deck",
  userInterfaceStyle: "dark",
  ios: {
    ...config.ios,
    bundleIdentifier: "stream.najtik.control",
    supportsTablet: false,
  },
  android: {
    ...config.android,
    package: "stream.najtik.control",
  },
  extra: {
    ...config.extra,
    webUrl: process.env.EXPO_PUBLIC_WEB_URL ?? "",
  },
});

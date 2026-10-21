import Constants from "expo-constants";
import { useState } from "react";
import {
  Pressable,
  StyleSheet,
  StatusBar,
  Text,
  View,
} from "react-native";
import {
  SafeAreaProvider,
  SafeAreaView,
} from "react-native-safe-area-context";
import { WebView } from "react-native-webview";

const configuredUrl = Constants.expoConfig?.extra?.webUrl;
const webUrl = (() => {
  if (typeof configuredUrl !== "string") return "";
  try {
    const url = new URL(configuredUrl.trim());
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.origin
      : "";
  } catch {
    return "";
  }
})();

export default function App() {
  const [reloadCount, setReloadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const adminUrl = webUrl ? `${webUrl}/dashboard/remote` : "";

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <StatusBar barStyle="light-content" />
        <View style={styles.toolbar}>
          <View>
            <Text style={styles.brand}>N4JT</Text>
            <Text style={styles.subtitle}>STREAM DECK</Text>
          </View>
          {adminUrl ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Obnoviť ovládací panel"
              onPress={() => {
                setLoadError(false);
                setLoading(true);
                setReloadCount((count) => count + 1);
              }}
              style={styles.refreshButton}
            >
              <Text style={styles.refreshText}>Obnoviť</Text>
            </Pressable>
          ) : null}
        </View>

        {!adminUrl ? (
          <View style={styles.messageCard}>
            <Text style={styles.messageTitle}>Chýba adresa Nextappu</Text>
            <Text style={styles.messageText}>
              Nastav EXPO_PUBLIC_WEB_URL na verejnú HTTPS adresu Nextappu a
              aplikáciu spusti znova.
            </Text>
          </View>
        ) : (
          <View style={styles.webViewContainer}>
            <WebView
              key={reloadCount}
              source={{ uri: adminUrl }}
              originWhitelist={[
                webUrl,
                "https://*.twitch.tv",
                "https://discord.com",
                "https://*.discord.com",
              ]}
              javaScriptEnabled
              domStorageEnabled
              sharedCookiesEnabled
              cacheEnabled
              onLoadStart={() => {
                setLoading(true);
                setLoadError(false);
              }}
              onLoadEnd={() => setLoading(false)}
              onError={() => {
                setLoadError(true);
                setLoading(false);
              }}
              style={styles.webView}
            />
            {(loading || loadError) && (
              <View style={styles.overlay}>
                <Text style={styles.messageTitle}>
                  {loadError ? "Nextapp sa nepodarilo načítať" : "Načítavam…"}
                </Text>
                {loadError && (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      setLoadError(false);
                      setLoading(true);
                      setReloadCount((count) => count + 1);
                    }}
                    style={styles.retryButton}
                  >
                    <Text style={styles.retryText}>Skúsiť znova</Text>
                  </Pressable>
                )}
              </View>
            )}
          </View>
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#09090b",
  },
  toolbar: {
    minHeight: 62,
    paddingHorizontal: 18,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#27272a",
  },
  brand: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 2,
  },
  subtitle: {
    marginTop: 2,
    color: "#a1a1aa",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 2,
  },
  refreshButton: {
    minHeight: 40,
    justifyContent: "center",
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#3f3f46",
    borderRadius: 12,
  },
  refreshText: {
    color: "#e4e4e7",
    fontSize: 12,
    fontWeight: "700",
  },
  webViewContainer: {
    flex: 1,
  },
  webView: {
    flex: 1,
    backgroundColor: "#09090b",
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 24,
    backgroundColor: "#09090b",
  },
  messageCard: {
    margin: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: "#27272a",
    borderRadius: 16,
    backgroundColor: "#18181b",
  },
  messageTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
  },
  messageText: {
    marginTop: 10,
    color: "#a1a1aa",
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
  },
  retryButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#6d28d9",
  },
  retryText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
});

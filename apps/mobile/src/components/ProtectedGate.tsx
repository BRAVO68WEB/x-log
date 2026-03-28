import { Pressable, StyleSheet, Text, View } from "react-native";
import { router, type Href } from "expo-router";
import { useTheme } from "@/theme/ThemeProvider";
import { Screen } from "./Screen";

export function ProtectedGate({
  title,
  description,
  loginTarget,
  backTarget = "/(tabs)/feed",
}: {
  title: string;
  description: string;
  loginTarget: Href;
  backTarget?: Href;
}) {
  const { colors } = useTheme();

  return (
    <Screen>
      <View style={styles.container}>
        <View
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.description, { color: colors.textMuted }]}>
            {description}
          </Text>
          <Pressable
            style={[styles.primaryButton, { backgroundColor: colors.accent }]}
            onPress={() => router.push(loginTarget)}
          >
            <Text
              style={[styles.primaryButtonText, { color: colors.accentContrast }]}
            >
              Login to continue
            </Text>
          </Pressable>
          <Pressable
            style={[styles.secondaryButton, { backgroundColor: colors.surfaceMuted }]}
            onPress={() => router.replace(backTarget)}
          >
            <Text style={[styles.secondaryButtonText, { color: colors.text }]}>
              Back to feed
            </Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
  },
  card: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
    gap: 14,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
  },
  description: {
    lineHeight: 22,
  },
  primaryButton: {
    borderRadius: 14,
    alignItems: "center",
    paddingVertical: 14,
  },
  primaryButtonText: {
    fontWeight: "700",
  },
  secondaryButton: {
    borderRadius: 14,
    alignItems: "center",
    paddingVertical: 14,
  },
  secondaryButtonText: {
    fontWeight: "700",
  },
});

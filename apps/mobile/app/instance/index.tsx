import { useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { useAuth } from "@/auth/AuthProvider";
import { LoadingState } from "@/components/LoadingState";
import { Screen } from "@/components/Screen";
import { resolveAssetUrl } from "@/lib/assets";
import { useTheme } from "@/theme/ThemeProvider";
import { Image } from "react-native";

export default function InstanceScreen() {
  const { colors } = useTheme();
  const { isReady, instances, addInstance, switchInstance } = useAuth();
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!isReady) {
    return <LoadingState />;
  }

  async function handleAdd() {
    try {
      setSubmitting(true);
      await addInstance(value);
      setValue("");
      router.replace("/(tabs)/feed");
    } catch (error) {
      Alert.alert("Unable to add instance", error instanceof Error ? error.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: colors.text }]}>
          {instances.length ? "Add another instance" : "Choose your first instance"}
        </Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          Enter the base URL of any x-log server. You can browse public posts without logging in and switch servers later.
        </Text>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.label, { color: colors.text }]}>Instance URL</Text>
          <TextInput
            value={value}
            onChangeText={setValue}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="https://example.com"
            placeholderTextColor={colors.textMuted}
            style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
          />
          <Pressable
            style={[styles.primaryButton, { backgroundColor: colors.accent }]}
            onPress={handleAdd}
            disabled={submitting}
          >
            <Text style={[styles.primaryButtonText, { color: colors.accentContrast }]}>
              {submitting ? "Adding..." : "Add Instance"}
            </Text>
          </Pressable>
        </View>

        {instances.length ? (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Saved instances</Text>
            <View style={styles.list}>
              {instances.map((instance) => {
                const bannerUrl = resolveAssetUrl(
                  instance.primaryProfile?.banner_url,
                  instance.apiBaseUrl
                );
                return (
                  <Pressable
                    key={instance.id}
                    style={[styles.instanceCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                    onPress={async () => {
                      await switchInstance(instance.id);
                      router.replace("/(tabs)/feed");
                    }}
                  >
                    {bannerUrl ? (
                      <Image source={{ uri: bannerUrl }} style={styles.banner} />
                    ) : null}
                    <Text style={[styles.instanceName, { color: colors.text }]}>{instance.instanceName}</Text>
                    <Text style={[styles.instanceMeta, { color: colors.textMuted }]}>
                      {instance.domain} · {instance.totalPublicPosts} public posts
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 20,
    gap: 20,
  },
  title: {
    fontSize: 30,
    fontWeight: "800",
  },
  subtitle: {
    lineHeight: 22,
  },
  card: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 18,
    gap: 12,
  },
  label: {
    fontWeight: "700",
  },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  primaryButton: {
    borderRadius: 14,
    alignItems: "center",
    paddingVertical: 14,
  },
  primaryButtonText: {
    fontWeight: "700",
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "800",
  },
  list: {
    gap: 12,
  },
  instanceCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    gap: 8,
  },
  banner: {
    width: "100%",
    height: 110,
    borderRadius: 14,
    backgroundColor: "#374151",
  },
  instanceName: {
    fontSize: 18,
    fontWeight: "700",
  },
  instanceMeta: {
    lineHeight: 20,
  },
});

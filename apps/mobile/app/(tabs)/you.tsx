import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Redirect, router } from "expo-router";
import { getProfile } from "@/api/profiles";
import { useAuth } from "@/auth/AuthProvider";
import { EmptyState } from "@/components/EmptyState";
import { LoadingState } from "@/components/LoadingState";
import { Screen } from "@/components/Screen";
import { resolveAssetUrl } from "@/lib/assets";
import { useTheme } from "@/theme/ThemeProvider";
import type { ThemePreference } from "@/theme/storage";

const themeOptions: ThemePreference[] = ["system", "light", "dark"];

export default function YouScreen() {
  const { colors, themePreference, setThemePreference } = useTheme();
  const {
    isReady,
    user,
    logout,
    instances,
    currentInstance,
    switchInstance,
    removeInstance,
  } = useAuth();

  const profileQuery = useQuery({
    queryKey: ["instance", currentInstance?.id, "profile", user?.username],
    queryFn: () =>
      getProfile(user!.username, {
        apiBaseUrl: currentInstance!.apiBaseUrl,
        token: currentInstance?.authToken,
      }),
    enabled: Boolean(user?.username && currentInstance),
    retry: false,
  });

  if (!isReady) {
    return <LoadingState />;
  }

  if (!currentInstance) {
    return <Redirect href="/instance" />;
  }

  if (user && profileQuery.isLoading) {
    return <LoadingState />;
  }

  const profile = profileQuery.data;
  const bannerUrl = resolveAssetUrl(profile?.banner_url, currentInstance.apiBaseUrl);
  const avatarUrl = resolveAssetUrl(user?.avatar_url || profile?.avatar_url, currentInstance.apiBaseUrl);
  const profileLinks = [
    profile?.social_website,
    profile?.social_github,
    profile?.social_x,
    profile?.social_youtube,
    profile?.social_reddit,
    profile?.social_linkedin,
  ].filter(Boolean) as string[];

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.heading, { color: colors.text }]}>You</Text>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Current instance</Text>
          <Text style={[styles.title, { color: colors.text }]}>{currentInstance.instanceName}</Text>
          <Text style={[styles.body, { color: colors.textMuted }]}>
            {currentInstance.domain} · {currentInstance.totalPublicPosts} public posts
          </Text>
          {currentInstance.instanceDescription ? (
            <Text style={[styles.body, { color: colors.textMuted }]}>
              {currentInstance.instanceDescription}
            </Text>
          ) : null}
        </View>

        {!user ? (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.title, { color: colors.text }]}>Browsing as guest</Text>
            <Text style={[styles.body, { color: colors.textMuted }]}>
              You can browse public posts from any saved instance without logging in. Login on the current instance to create and edit posts there.
            </Text>
            <Pressable
              style={[styles.primaryButton, { backgroundColor: colors.accent }]}
              onPress={() => router.push("/(auth)/login?redirect=/(tabs)/you")}
            >
              <Text style={[styles.primaryButtonText, { color: colors.accentContrast }]}>Login</Text>
            </Pressable>
          </View>
        ) : (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {bannerUrl ? (
              <Image source={{ uri: bannerUrl }} style={styles.banner} resizeMode="cover" />
            ) : null}
            <View style={styles.identityRow}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatarPlaceholder, { backgroundColor: colors.accentSoft }]}>
                  <Text style={[styles.avatarInitial, { color: colors.accent }]}>
                    {user.username[0]?.toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={styles.identityText}>
                <Text style={[styles.title, { color: colors.text }]}>
                  {profile?.full_name || user.username}
                </Text>
                <Text style={[styles.meta, { color: colors.textMuted }]}>@{user.username}</Text>
                <Text style={[styles.meta, { color: colors.textMuted }]}>
                  {user.email || "No email on file"} · {user.role}
                </Text>
              </View>
            </View>

            {profile?.bio ? <Text style={[styles.body, { color: colors.text }]}>{profile.bio}</Text> : null}

            {profileLinks.length ? (
              <View style={styles.linkGroup}>
                {profileLinks.map((link) => (
                  <Text key={link} style={[styles.linkText, { color: colors.accent }]}>
                    {link}
                  </Text>
                ))}
              </View>
            ) : (
              <EmptyState
                title="Profile details not set yet"
                description="Your account works, but there are no public profile details to show yet."
              />
            )}

            <Pressable
              style={[styles.secondaryButton, { backgroundColor: colors.surfaceMuted }]}
              onPress={() => void logout()}
            >
              <Text style={[styles.secondaryButtonText, { color: colors.text }]}>Logout from this instance</Text>
            </Pressable>
          </View>
        )}

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.rowBetween}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Instances</Text>
            <Pressable
              style={[styles.inlineButton, { backgroundColor: colors.accentSoft }]}
              onPress={() => router.push("/instance")}
            >
              <Text style={[styles.inlineButtonText, { color: colors.accent }]}>Add Instance</Text>
            </Pressable>
          </View>
          <View style={styles.instanceList}>
            {instances.map((instance) => {
              const profileName =
                instance.primaryProfile?.full_name || instance.primaryProfile?.username || "Guest";
              return (
                <View
                  key={instance.id}
                  style={[styles.instanceRow, { borderColor: colors.border }]}
                >
                  <Pressable
                    style={styles.instanceInfo}
                    onPress={() => void switchInstance(instance.id)}
                  >
                    <Text style={[styles.instanceName, { color: colors.text }]}>
                      {instance.instanceName}
                      {instance.id === currentInstance.id ? " · Current" : ""}
                    </Text>
                    <Text style={[styles.instanceMeta, { color: colors.textMuted }]}>
                      {instance.domain} · {profileName} · {instance.authToken ? "Logged in" : "Guest"}
                    </Text>
                    <Text style={[styles.instanceMeta, { color: colors.textMuted }]}>
                      {instance.totalPublicPosts} public posts
                    </Text>
                  </Pressable>
                  {instances.length > 1 ? (
                    <Pressable
                      style={[styles.removeButton, { backgroundColor: colors.surfaceMuted }]}
                      onPress={() => void removeInstance(instance.id)}
                    >
                      <Text style={[styles.removeButtonText, { color: colors.text }]}>Remove</Text>
                    </Pressable>
                  ) : null}
                </View>
              );
            })}
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Appearance</Text>
          <Text style={[styles.body, { color: colors.textMuted }]}>
            Choose how the app handles light and dark themes.
          </Text>
          <View style={styles.themeRow}>
            {themeOptions.map((option) => {
              const active = option === themePreference;
              return (
                <Pressable
                  key={option}
                  style={[
                    styles.themeButton,
                    {
                      backgroundColor: active ? colors.accent : colors.surfaceMuted,
                    },
                  ]}
                  onPress={() => void setThemePreference(option)}
                >
                  <Text
                    style={{
                      color: active ? colors.accentContrast : colors.text,
                      fontWeight: "700",
                      textTransform: "capitalize",
                    }}
                  >
                    {option}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    gap: 16,
  },
  heading: {
    fontSize: 30,
    fontWeight: "800",
  },
  card: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 16,
    gap: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
  },
  body: {
    fontSize: 15,
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
  banner: {
    width: "100%",
    height: 160,
    borderRadius: 18,
    backgroundColor: "#1f2937",
  },
  identityRow: {
    flexDirection: "row",
    gap: 14,
    alignItems: "center",
  },
  identityText: {
    flex: 1,
    gap: 2,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#374151",
  },
  avatarPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    fontSize: 24,
    fontWeight: "800",
  },
  meta: {
    fontSize: 14,
  },
  linkGroup: {
    gap: 8,
  },
  linkText: {
    fontWeight: "600",
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  inlineButton: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  inlineButtonText: {
    fontWeight: "700",
  },
  instanceList: {
    gap: 12,
  },
  instanceRow: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    gap: 10,
  },
  instanceInfo: {
    gap: 4,
  },
  instanceName: {
    fontSize: 16,
    fontWeight: "700",
  },
  instanceMeta: {
    lineHeight: 20,
  },
  removeButton: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  removeButtonText: {
    fontWeight: "700",
  },
  themeRow: {
    flexDirection: "row",
    gap: 10,
  },
  themeButton: {
    flex: 1,
    borderRadius: 12,
    alignItems: "center",
    paddingVertical: 12,
  },
});

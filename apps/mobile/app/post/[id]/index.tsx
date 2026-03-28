import { Pressable, ScrollView, StyleSheet, Text, View, Image } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { getPost } from "@/api/posts";
import { useAuth } from "@/auth/AuthProvider";
import { EmptyState } from "@/components/EmptyState";
import { LoadingState } from "@/components/LoadingState";
import { MarkdownContent } from "@/components/MarkdownContent";
import { Screen } from "@/components/Screen";
import { resolveAssetUrl } from "@/lib/assets";
import { useTheme } from "@/theme/ThemeProvider";

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, currentInstance, isReady } = useAuth();
  const { colors } = useTheme();
  const postQuery = useQuery({
    queryKey: ["instance", currentInstance?.id, "post", id],
    queryFn: () =>
      getPost(id, {
        apiBaseUrl: currentInstance!.apiBaseUrl,
        token: currentInstance?.authToken,
      }),
    enabled: Boolean(id && currentInstance),
  });

  if (!isReady) {
    return <LoadingState />;
  }

  if (!currentInstance) {
    return <Redirect href="/instance" />;
  }

  if (postQuery.isLoading) {
    return <LoadingState />;
  }

  if (postQuery.error || !postQuery.data) {
    return (
      <Screen>
        <EmptyState
          title="Unable to load post"
          description={postQuery.error instanceof Error ? postQuery.error.message : "Post not found"}
        />
      </Screen>
    );
  }

  const post = postQuery.data;
  const canEdit = Boolean(user && (user.id === post.author_id || user.role === "admin"));
  const bannerUrl = resolveAssetUrl(post.banner_url, currentInstance.apiBaseUrl);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        {bannerUrl ? (
          <Image source={{ uri: bannerUrl }} style={styles.banner} />
        ) : null}

        <Text style={[styles.title, { color: colors.text }]}>{post.title}</Text>
        <Text style={[styles.meta, { color: colors.textMuted }]}>
          {post.author.full_name || post.author.username}
          {post.published_at ? ` · ${new Date(post.published_at).toLocaleDateString()}` : " · Draft"}
        </Text>

        {canEdit ? (
          <Pressable style={[styles.editButton, { backgroundColor: colors.accentSoft }]} onPress={() => router.push(`/post/${post.id}/edit`)}>
            <Text style={[styles.editButtonText, { color: colors.accent }]}>Edit Post</Text>
          </Pressable>
        ) : null}

        {post.summary ? <Text style={[styles.summary, { color: colors.text }]}>{post.summary}</Text> : null}

        <View style={[styles.bodyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <MarkdownContent markdown={post.content_markdown} />
        </View>

        {post.hashtags.length ? (
          <Text style={[styles.tags, { color: colors.success }]}>{post.hashtags.map((tag) => `#${tag}`).join(" ")}</Text>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    gap: 16,
  },
  banner: {
    width: "100%",
    height: 220,
    borderRadius: 20,
    backgroundColor: "#d1d5db",
  },
  title: {
    fontSize: 30,
    fontWeight: "800",
    color: "#111827",
  },
  meta: {
  },
  editButton: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  editButtonText: {
    fontWeight: "700",
  },
  summary: {
    fontSize: 16,
    lineHeight: 24,
  },
  bodyCard: {
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
  },
  tags: {
    fontWeight: "700",
  },
});

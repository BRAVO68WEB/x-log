import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import type { PostSummary } from "@/api/types";
import { resolveAssetUrl } from "@/lib/assets";
import { useTheme } from "@/theme/ThemeProvider";

function makeExcerpt(markdown: string) {
  return markdown
    .replace(/[#>*_`!\[\]\(\)-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 140);
}

export function PostCard({
  post,
  onPress,
  apiBaseUrl,
}: {
  post: PostSummary;
  onPress: () => void;
  apiBaseUrl?: string | null;
}) {
  const { colors } = useTheme();
  const bannerUrl = resolveAssetUrl(post.banner_url, apiBaseUrl);

  return (
    <Pressable
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={onPress}
    >
      {bannerUrl ? (
        <Image source={{ uri: bannerUrl }} style={styles.banner} resizeMode="cover" />
      ) : null}
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.text }]}>{post.title || "Untitled"}</Text>
        <Text style={[styles.meta, { color: colors.textMuted }]}>
          {post.author.full_name || post.author.username}
          {post.published_at ? ` · ${new Date(post.published_at).toLocaleDateString()}` : " · Draft"}
        </Text>
        <Text style={[styles.excerpt, { color: colors.text }]}>
          {makeExcerpt(post.content_markdown) || "No preview available."}
        </Text>
        {post.hashtags.length ? (
          <Text style={[styles.tags, { color: colors.success }]}>
            {post.hashtags.map((tag) => `#${tag}`).join(" ")}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
  },
  banner: {
    width: "100%",
    height: 180,
    backgroundColor: "#e5e7eb",
  },
  content: {
    padding: 16,
    gap: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
  },
  meta: {
    fontSize: 13,
  },
  excerpt: {
    lineHeight: 20,
  },
  tags: {
    fontWeight: "600",
  },
});

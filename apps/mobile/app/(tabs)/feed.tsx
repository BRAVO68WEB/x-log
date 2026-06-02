import { useEffect, useRef, useState } from "react";
import {
  FlatList,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Redirect, router } from "expo-router";
import { likePost, listFollowingFeed, listPosts, unlikePost } from "@/api/posts";
import { useAuth } from "@/auth/AuthProvider";
import { EmptyState } from "@/components/EmptyState";
import { LoadingState } from "@/components/LoadingState";
import { PostCard } from "@/components/PostCard";
import { Screen } from "@/components/Screen";
import type { SavedInstance } from "@/lib/instances";
import { useTheme } from "@/theme/ThemeProvider";

export default function FeedScreen() {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const pagerRef = useRef<FlatList<SavedInstance>>(null);
  const { isReady, instances, currentInstance, switchInstance } = useAuth();

  useEffect(() => {
    if (!currentInstance) {
      return;
    }

    const index = instances.findIndex((instance) => instance.id === currentInstance.id);
    if (index >= 0) {
      pagerRef.current?.scrollToIndex({ index, animated: false });
    }
  }, [currentInstance?.id, instances]);

  if (!isReady) {
    return <LoadingState />;
  }

  if (!instances.length) {
    return <Redirect href="/instance" />;
  }

  return (
    <Screen>
      <FlatList
        ref={pagerRef}
        data={instances}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(event: NativeSyntheticEvent<NativeScrollEvent>) => {
          const nextIndex = Math.round(event.nativeEvent.contentOffset.x / width);
          const nextInstance = instances[nextIndex];
          if (nextInstance && nextInstance.id !== currentInstance?.id) {
            void switchInstance(nextInstance.id);
          }
        }}
        renderItem={({ item }) => <FeedPage instance={item} pageWidth={width} />}
      />
      <View style={[styles.pagerDots, { backgroundColor: colors.surface }]}>
        {instances.map((instance) => (
          <View
            key={instance.id}
            style={[
              styles.dot,
              {
                backgroundColor:
                  instance.id === currentInstance?.id ? colors.accent : colors.border,
              },
            ]}
          />
        ))}
      </View>
    </Screen>
  );
}

function FeedPage({ instance, pageWidth }: { instance: SavedInstance; pageWidth: number }) {
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"local" | "following">("local");
  const postsQuery = useQuery({
    queryKey: ["instance", instance.id, "posts"],
    queryFn: () =>
      listPosts(undefined, {
        apiBaseUrl: instance.apiBaseUrl,
        token: instance.authToken,
      }),
  });
  const followingQuery = useQuery({
    queryKey: ["instance", instance.id, "following-feed"],
    queryFn: () =>
      listFollowingFeed({
        apiBaseUrl: instance.apiBaseUrl,
        token: instance.authToken,
      }),
    enabled: mode === "following" && Boolean(instance.authToken),
  });

  const likeMutation = useMutation({
    mutationFn: (post: { id: string; liked_by_me?: boolean }) =>
      post.liked_by_me
        ? unlikePost(post.id, { apiBaseUrl: instance.apiBaseUrl, token: instance.authToken })
        : likePost(post.id, { apiBaseUrl: instance.apiBaseUrl, token: instance.authToken }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["instance", instance.id, "posts"] });
    },
  });

  const followingItems = followingQuery.data?.items || [];
  const feedItems = mode === "local" ? postsQuery.data?.items || [] : followingItems;

  return (
    <FlatList<any>
      style={{ width: pageWidth }}
      data={feedItems}
      keyExtractor={(item) => `${instance.id}:${item.id}`}
      contentContainerStyle={styles.listContent}
      refreshing={mode === "local" ? postsQuery.isRefetching : followingQuery.isRefetching}
      onRefresh={() => void (mode === "local" ? postsQuery.refetch() : followingQuery.refetch())}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>{instance.instanceName}</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            {instance.domain} · {instance.totalPublicPosts} public posts
          </Text>
          {instance.instanceDescription ? (
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>
              {instance.instanceDescription}
            </Text>
          ) : null}
          <View style={[styles.segmentRow, { backgroundColor: colors.surfaceMuted }]}>
            <Pressable
              onPress={() => setMode("local")}
              style={[
                styles.segmentButton,
                { backgroundColor: mode === "local" ? colors.surface : "transparent" },
              ]}
            >
              <Text style={{ color: mode === "local" ? colors.text : colors.textMuted }}>
                Local
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setMode("following")}
              style={[
                styles.segmentButton,
                { backgroundColor: mode === "following" ? colors.surface : "transparent" },
              ]}
            >
              <Text style={{ color: mode === "following" ? colors.text : colors.textMuted }}>
                Following
              </Text>
            </Pressable>
          </View>
        </View>
      }
      ListEmptyComponent={
        (mode === "local" ? postsQuery.isLoading : followingQuery.isLoading) ? (
          <LoadingState />
        ) : (mode === "local" ? postsQuery.error : followingQuery.error) ? (
          <EmptyState
            title="Unable to load feed"
            description={
              (mode === "local" ? postsQuery.error : followingQuery.error) instanceof Error
                ? ((mode === "local" ? postsQuery.error : followingQuery.error) as Error).message
                : "Unknown error"
            }
          />
        ) : mode === "following" ? (
          <EmptyState
            title="No followed posts yet"
            description="Follow profiles from the web Settings page to populate this feed."
          />
        ) : (
          <EmptyState
            title="No posts yet"
            description="Published posts from this instance will show up here."
          />
        )
      }
      renderItem={({ item }) =>
        mode === "local" ? (
          <PostCard
            post={item as any}
            apiBaseUrl={instance.apiBaseUrl}
            onPress={() => router.push(`/post/${(item as any).id}`)}
            onToggleLike={() => {
              if (!instance.authToken) {
                router.push("/(auth)/login?redirect=/(tabs)/feed");
                return;
              }
              likeMutation.mutate(item as any);
            }}
          />
        ) : (
          <View
            style={[
              styles.remoteCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.remoteActor, { color: colors.accent }]}>
              {(item as any).actor_handle || (item as any).actor}
            </Text>
            <Text style={[styles.remoteTitle, { color: colors.text }]}>
              {(item as any).title || "Remote post"}
            </Text>
            {(item as any).summary ? (
              <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                {(item as any).summary}
              </Text>
            ) : null}
            <Pressable onPress={() => void Linking.openURL((item as any).url)}>
              <Text style={[styles.remoteLink, { color: colors.accent }]}>Open remote post</Text>
            </Pressable>
          </View>
        )
      }
      ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
      ListFooterComponent={
        mode === "local" && postsQuery.data?.hasMore ? (
          <Pressable
            style={[styles.loadMoreButton, { backgroundColor: colors.surfaceMuted }]}
            onPress={() => void postsQuery.refetch()}
          >
            <Text style={[styles.loadMoreText, { color: colors.text }]}>
              Refresh for newer pages
            </Text>
          </Pressable>
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 16,
    gap: 6,
  },
  segmentRow: {
    flexDirection: "row",
    borderRadius: 999,
    padding: 4,
    marginTop: 10,
    alignSelf: "flex-start",
  },
  segmentButton: {
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  title: {
    fontSize: 30,
    fontWeight: "400",
  },
  subtitle: {
    lineHeight: 20,
  },
  loadMoreButton: {
    alignSelf: "center",
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 999,
  },
  loadMoreText: {
    fontWeight: "500",
  },
  pagerDots: {
    position: "absolute",
    bottom: 16,
    alignSelf: "center",
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  remoteCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    gap: 8,
  },
  remoteActor: {
    fontSize: 13,
    fontWeight: "500",
  },
  remoteTitle: {
    fontSize: 20,
    fontWeight: "500",
  },
  remoteLink: {
    fontWeight: "500",
  },
});

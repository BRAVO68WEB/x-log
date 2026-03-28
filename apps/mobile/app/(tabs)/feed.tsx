import { useEffect, useRef } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Redirect, router } from "expo-router";
import { listPosts } from "@/api/posts";
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
  const postsQuery = useQuery({
    queryKey: ["instance", instance.id, "posts"],
    queryFn: () =>
      listPosts(undefined, {
        apiBaseUrl: instance.apiBaseUrl,
        token: instance.authToken,
      }),
  });

  return (
    <FlatList
      style={{ width: pageWidth }}
      data={postsQuery.data?.items || []}
      keyExtractor={(item) => `${instance.id}:${item.id}`}
      contentContainerStyle={styles.listContent}
      refreshing={postsQuery.isRefetching}
      onRefresh={() => void postsQuery.refetch()}
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
        </View>
      }
      ListEmptyComponent={
        postsQuery.isLoading ? (
          <LoadingState />
        ) : postsQuery.error ? (
          <EmptyState
            title="Unable to load feed"
            description={
              postsQuery.error instanceof Error ? postsQuery.error.message : "Unknown error"
            }
          />
        ) : (
          <EmptyState
            title="No posts yet"
            description="Published posts from this instance will show up here."
          />
        )
      }
      renderItem={({ item }) => (
        <PostCard
          post={item}
          apiBaseUrl={instance.apiBaseUrl}
          onPress={() => router.push(`/post/${item.id}`)}
        />
      )}
      ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
      ListFooterComponent={
        postsQuery.data?.hasMore ? (
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
  title: {
    fontSize: 30,
    fontWeight: "800",
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
    fontWeight: "700",
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
});

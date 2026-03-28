import { useEffect, useMemo, useState, type ComponentProps } from "react";
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { createPost, getPost, publishPost, updatePost } from "@/api/posts";
import { uploadBannerAsync, uploadImageAsync } from "@/api/media";
import { useAuth } from "@/auth/AuthProvider";
import { EmptyState } from "@/components/EmptyState";
import { LoadingState } from "@/components/LoadingState";
import { MarkdownContent } from "@/components/MarkdownContent";
import { Screen } from "@/components/Screen";
import { resolveAssetUrl } from "@/lib/assets";
import { useTheme } from "@/theme/ThemeProvider";

function hashtagsToArray(input: string) {
  return input
    .split(/[,\s]+/)
    .map((tag) => tag.trim().replace(/^#/, ""))
    .filter(Boolean);
}

export function PostEditorScreen({ postId }: { postId?: string }) {
  const { colors } = useTheme();
  const { currentInstance } = useAuth();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");
  const [bannerUploading, setBannerUploading] = useState(false);
  const [hashtags, setHashtags] = useState("");
  const [markdown, setMarkdown] = useState("");
  const [mode, setMode] = useState<"write" | "preview">("write");

  const requestContext = currentInstance
    ? {
        apiBaseUrl: currentInstance.apiBaseUrl,
        token: currentInstance.authToken,
      }
    : undefined;

  const postQuery = useQuery({
    queryKey: ["instance", currentInstance?.id, "post", postId],
    queryFn: () => getPost(postId!, requestContext),
    enabled: Boolean(postId && requestContext),
  });

  useEffect(() => {
    if (!postQuery.data) {
      return;
    }

    setTitle(postQuery.data.title || "");
    setSummary(postQuery.data.summary || "");
    setBannerUrl(postQuery.data.banner_url || "");
    setHashtags(postQuery.data.hashtags.join(", "));
    setMarkdown(postQuery.data.content_markdown || "");
  }, [postQuery.data]);

  const submitMutation = useMutation({
    mutationFn: async ({ publish }: { publish: boolean }) => {
      if (!requestContext) {
        throw new Error("No instance selected.");
      }

      const visibility: "public" | "private" = publish ? "public" : "private";
      const payload = {
        title: title.trim() || "Untitled",
        summary: summary.trim() || undefined,
        banner_url: bannerUrl.trim() || undefined,
        hashtags: hashtagsToArray(hashtags),
        content_markdown: markdown.trim(),
        visibility,
      };

      if (!payload.content_markdown) {
        throw new Error("Post body is required.");
      }

      if (!postId) {
        const created = await createPost(payload, requestContext);
        if (publish) {
          await publishPost(created.id, requestContext);
        }
        return { id: created.id };
      }

      await updatePost(postId, payload, requestContext);
      if (publish && !postQuery.data?.published_at) {
        await publishPost(postId, requestContext);
      }

      return { id: postId };
    },
    onSuccess: async ({ id }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["instance", currentInstance?.id, "posts"] }),
        queryClient.invalidateQueries({ queryKey: ["instance", currentInstance?.id, "post", id] }),
      ]);
      router.replace(`/post/${id}`);
    },
    onError: (error) => {
      Alert.alert("Unable to save post", error instanceof Error ? error.message : "Unknown error");
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!requestContext) {
        throw new Error("No instance selected.");
      }

      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        throw new Error("Photo library permission is required.");
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.9,
      });

      if (result.canceled || !result.assets[0]) {
        return null;
      }

      return uploadImageAsync(result.assets[0], requestContext);
    },
    onSuccess: (response) => {
      if (!response?.url) {
        return;
      }
      setMarkdown((current) => `${current.trim()}\n\n![image](${response.url})\n`.trim());
    },
    onError: (error) => {
      Alert.alert("Upload failed", error instanceof Error ? error.message : "Unknown error");
    },
  });

  const uploadBannerMutation = useMutation({
    mutationFn: async () => {
      if (!requestContext) {
        throw new Error("No instance selected.");
      }

      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        throw new Error("Photo library permission is required.");
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.9,
      });

      if (result.canceled || !result.assets[0]) {
        return null;
      }

      return uploadBannerAsync(result.assets[0], requestContext);
    },
    onMutate: () => {
      setBannerUploading(true);
    },
    onSuccess: (response) => {
      if (!response?.url) {
        return;
      }
      setBannerUrl(response.url);
    },
    onError: (error) => {
      Alert.alert("Banner upload failed", error instanceof Error ? error.message : "Unknown error");
    },
    onSettled: () => {
      setBannerUploading(false);
    },
  });

  const headingLabel = useMemo(() => {
    if (!postId) return "Create Post";
    return postQuery.data?.published_at ? "Update Post" : "Edit Draft";
  }, [postId, postQuery.data?.published_at]);

  const bannerPreviewUrl = resolveAssetUrl(bannerUrl, currentInstance?.apiBaseUrl);

  if (!currentInstance) {
    return (
      <Screen>
        <EmptyState
          title="No instance selected"
          description="Add or switch to an instance before creating or editing posts."
        />
      </Screen>
    );
  }

  if (postId && postQuery.isLoading) {
    return <LoadingState />;
  }

  return (
    <Screen>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
        <Text style={[styles.heading, { color: colors.text }]}>{headingLabel}</Text>
        <Text style={[styles.instanceLabel, { color: colors.textMuted }]}>
          Posting to {currentInstance.instanceName}
        </Text>

        <View style={[styles.segmentRow, { backgroundColor: colors.surfaceMuted }]}>
          <SegmentButton
            active={mode === "write"}
            label="Write"
            onPress={() => setMode("write")}
            colors={colors}
          />
          <SegmentButton
            active={mode === "preview"}
            label="Preview"
            onPress={() => setMode("preview")}
            colors={colors}
          />
        </View>

        <Field label="Title" value={title} onChangeText={setTitle} placeholder="Untitled" colors={colors} />
        <Field
          label="Summary"
          value={summary}
          onChangeText={setSummary}
          placeholder="Short summary"
          multiline
          colors={colors}
        />
        <Field
          label="Hashtags"
          value={hashtags}
          onChangeText={setHashtags}
          placeholder="fediverse, activitypub"
          colors={colors}
        />
        <Field
          label="Banner URL"
          value={bannerUrl}
          onChangeText={setBannerUrl}
          placeholder="https://example.com/banner.jpg"
          colors={colors}
        />

        <View style={styles.bannerActions}>
          <Pressable
            onPress={() => uploadBannerMutation.mutate()}
            style={[styles.secondaryButton, { backgroundColor: colors.accentSoft }]}
            disabled={bannerUploading}
          >
            <Text style={[styles.secondaryButtonText, { color: colors.accent }]}>
              {bannerUploading ? "Uploading banner..." : "Upload Banner"}
            </Text>
          </Pressable>
          {bannerUrl ? (
            <Pressable
              onPress={() => setBannerUrl("")}
              style={[styles.secondaryButton, { backgroundColor: colors.surfaceMuted }]}
            >
              <Text style={[styles.secondaryButtonText, { color: colors.text }]}>Remove Banner</Text>
            </Pressable>
          ) : null}
        </View>

        {bannerPreviewUrl ? (
          <View
            style={[
              styles.bannerPreview,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <Text style={[styles.label, { color: colors.text }]}>Banner Preview</Text>
            <Image
              source={{ uri: bannerPreviewUrl }}
              style={[styles.bannerPreviewImage, { backgroundColor: colors.surfaceMuted }]}
              resizeMode="cover"
            />
          </View>
        ) : null}

        <View style={styles.sectionHeader}>
          <Text style={[styles.label, { color: colors.text }]}>Content</Text>
          <Pressable
            onPress={() => uploadMutation.mutate()}
            style={[styles.secondaryButton, { backgroundColor: colors.accentSoft }]}
            disabled={uploadMutation.isPending}
          >
            <Text style={[styles.secondaryButtonText, { color: colors.accent }]}>
              {uploadMutation.isPending ? "Uploading..." : "Upload Image"}
            </Text>
          </Pressable>
        </View>

        {mode === "write" ? (
          <TextInput
            value={markdown}
            onChangeText={setMarkdown}
            placeholder="Write Markdown here..."
            placeholderTextColor={colors.textMuted}
            multiline
            textAlignVertical="top"
            style={[
              styles.editor,
              {
                borderColor: colors.border,
                backgroundColor: colors.surface,
                color: colors.text,
              },
            ]}
          />
        ) : (
          <View
            style={[
              styles.previewCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <MarkdownContent markdown={markdown || "_Nothing to preview yet._"} />
          </View>
        )}

        <View style={styles.actions}>
          <ActionButton
            label={submitMutation.isPending ? "Saving..." : "Save Draft"}
            onPress={() => submitMutation.mutate({ publish: false })}
            disabled={submitMutation.isPending}
            variant="secondary"
            colors={colors}
          />
          <ActionButton
            label={submitMutation.isPending ? "Publishing..." : postQuery.data?.published_at ? "Update" : "Publish"}
            onPress={() => submitMutation.mutate({ publish: true })}
            disabled={submitMutation.isPending}
            variant="primary"
            colors={colors}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

function Field({
  label,
  multiline = false,
  colors,
  ...props
}: ComponentProps<typeof TextInput> & {
  label: string;
  multiline?: boolean;
  colors: ReturnType<typeof useTheme>["colors"];
}) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      <TextInput
        {...props}
        multiline={multiline}
        placeholderTextColor={colors.textMuted}
        style={[
          styles.input,
          multiline && styles.multilineInput,
          { borderColor: colors.border, backgroundColor: colors.surface, color: colors.text },
        ]}
      />
    </View>
  );
}

function SegmentButton({
  active,
  label,
  onPress,
  colors,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
  colors: ReturnType<typeof useTheme>["colors"];
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.segmentButton,
        active && [styles.segmentButtonActive, { backgroundColor: colors.surface }],
      ]}
    >
      <Text
        style={[
          styles.segmentButtonText,
          { color: colors.textMuted },
          active && [styles.segmentButtonTextActive, { color: colors.text }],
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function ActionButton({
  label,
  onPress,
  disabled,
  variant,
  colors,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant: "primary" | "secondary";
  colors: ReturnType<typeof useTheme>["colors"];
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.actionButton,
        variant === "primary"
          ? [styles.primaryButton, { backgroundColor: colors.accent }]
          : [styles.secondaryActionButton, { backgroundColor: colors.surfaceMuted }],
        disabled && styles.disabledButton,
      ]}
    >
      <Text
        style={
          variant === "primary"
            ? [styles.primaryButtonText, { color: colors.accentContrast }]
            : [styles.secondaryActionText, { color: colors.text }]
        }
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    gap: 16,
    paddingBottom: 32,
  },
  heading: {
    fontSize: 28,
    fontWeight: "800",
  },
  instanceLabel: {
    marginTop: -8,
  },
  segmentRow: {
    flexDirection: "row",
    borderRadius: 14,
    padding: 4,
  },
  segmentButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 10,
  },
  segmentButtonActive: {},
  segmentButtonText: {
    fontWeight: "600",
  },
  segmentButtonTextActive: {},
  fieldGroup: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: "700",
  },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  multilineInput: {
    minHeight: 88,
    textAlignVertical: "top",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  bannerActions: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
  },
  secondaryButton: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  secondaryButtonText: {
    fontWeight: "700",
  },
  bannerPreview: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    gap: 10,
  },
  bannerPreviewImage: {
    height: 140,
    borderRadius: 14,
  },
  editor: {
    minHeight: 320,
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    fontSize: 16,
  },
  previewCard: {
    minHeight: 320,
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
  },
  actions: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },
  actionButton: {
    flex: 1,
    borderRadius: 14,
    alignItems: "center",
    paddingVertical: 14,
  },
  primaryButton: {},
  primaryButtonText: {
    fontWeight: "700",
  },
  secondaryActionButton: {},
  secondaryActionText: {
    fontWeight: "700",
  },
  disabledButton: {
    opacity: 0.7,
  },
});

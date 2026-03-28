import { useLocalSearchParams } from "expo-router";
import { useAuth } from "@/auth/AuthProvider";
import { LoadingState } from "@/components/LoadingState";
import { ProtectedGate } from "@/components/ProtectedGate";
import { PostEditorScreen } from "@/features/editor/PostEditorScreen";
import { Redirect } from "expo-router";

export default function EditPostScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isReady, user, currentInstance } = useAuth();

  if (!isReady) {
    return <LoadingState />;
  }

  if (!currentInstance) {
    return <Redirect href="/instance" />;
  }

  if (!user) {
    return (
      <ProtectedGate
        title="Login required"
        description={`Editing on ${currentInstance.instanceName} requires your account so we can verify you own this post.`}
        loginTarget={`/(auth)/login?redirect=/post/${id}/edit`}
        backTarget={`/post/${id}`}
      />
    );
  }

  return <PostEditorScreen postId={id} />;
}

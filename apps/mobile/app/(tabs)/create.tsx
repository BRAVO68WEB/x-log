import { useAuth } from "@/auth/AuthProvider";
import { LoadingState } from "@/components/LoadingState";
import { ProtectedGate } from "@/components/ProtectedGate";
import { PostEditorScreen } from "@/features/editor/PostEditorScreen";
import { Redirect } from "expo-router";

export default function CreateScreen() {
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
        description={`Writing on ${currentInstance.instanceName} requires an account on that instance. Login first, then you can come right back here.`}
        loginTarget="/(auth)/login?redirect=/(tabs)/create"
      />
    );
  }

  return <PostEditorScreen />;
}

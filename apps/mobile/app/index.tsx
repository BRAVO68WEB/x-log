import { Redirect } from "expo-router";
import { useAuth } from "@/auth/AuthProvider";
import { LoadingState } from "@/components/LoadingState";

export default function IndexScreen() {
  const { isReady, instances } = useAuth();

  if (!isReady) {
    return <LoadingState />;
  }

  return <Redirect href={instances.length ? "/(tabs)/feed" : "/instance"} />;
}

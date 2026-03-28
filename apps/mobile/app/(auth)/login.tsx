import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { useAuth } from "@/auth/AuthProvider";
import { LoadingState } from "@/components/LoadingState";
import { useTheme } from "@/theme/ThemeProvider";
import { sanitizeRedirect } from "@/lib/navigation";

export default function LoginScreen() {
  const { isReady, user, login, currentInstance } = useAuth();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ redirect?: string }>();
  const redirectTarget = sanitizeRedirect(params.redirect);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!isReady) {
    return <LoadingState />;
  }

  if (!currentInstance) {
    return <Redirect href="/instance" />;
  }

  if (user) {
    return <Redirect href={redirectTarget} />;
  }

  async function handleLogin() {
    try {
      setSubmitting(true);
      await login(username, password);
      router.replace(redirectTarget);
    } catch (error) {
      Alert.alert("Login failed", error instanceof Error ? error.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.select({ ios: "padding", default: undefined })}
    >
      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        <Text style={[styles.title, { color: colors.text }]}>Sign in</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          Sign in to {currentInstance.instanceName} with your existing x-log username and password.
        </Text>
        <TextInput
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          placeholder="Username"
          placeholderTextColor={colors.textMuted}
          style={[styles.input, { borderColor: colors.border, backgroundColor: colors.surface, color: colors.text }]}
        />
        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="Password"
          placeholderTextColor={colors.textMuted}
          style={[styles.input, { borderColor: colors.border, backgroundColor: colors.surface, color: colors.text }]}
        />
        <Pressable style={[styles.button, { backgroundColor: colors.accent }]} onPress={handleLogin} disabled={submitting}>
          <Text style={[styles.buttonText, { color: colors.accentContrast }]}>
            {submitting ? "Signing in..." : "Login"}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f3f4f6",
    justifyContent: "center",
    padding: 20,
  },
  card: {
    borderRadius: 24,
    backgroundColor: "#ffffff",
    padding: 20,
    gap: 14,
  },
  title: {
    fontSize: 30,
    fontWeight: "800",
    color: "#111827",
  },
  subtitle: {
    color: "#6b7280",
  },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#ffffff",
  },
  button: {
    backgroundColor: "#111827",
    borderRadius: 14,
    alignItems: "center",
    paddingVertical: 14,
  },
  buttonText: {
    color: "#ffffff",
    fontWeight: "700",
  },
});

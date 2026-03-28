import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getCurrentUser, login as loginRequest, logout as logoutRequest } from "@/api/auth";
import { getPublicInstanceSummary } from "@/api/instance";
import {
  setApiBaseUrl,
  setApiToken,
  setUnauthorizedHandler,
} from "@/api/client";
import type { User } from "@/api/types";
import {
  clearLegacyStoredToken,
  clearStoredToken,
  getLegacyStoredToken,
  getStoredToken,
  setStoredToken,
} from "./storage";
import {
  apiBaseToBaseUrl,
  clearStoredCurrentInstanceId,
  getBootstrapApiBaseUrl,
  getStoredCurrentInstanceId,
  loadStoredInstances,
  mergeSummary,
  normalizeInstanceUrl,
  resolveInstanceFromInput,
  saveStoredInstances,
  setStoredCurrentInstanceId,
  toSavedInstance,
  toStoredInstance,
  type SavedInstance,
} from "@/lib/instances";

interface AuthContextValue {
  user: User | null;
  token: string | null;
  isReady: boolean;
  instances: SavedInstance[];
  currentInstance: SavedInstance | null;
  addInstance: (inputUrl: string) => Promise<SavedInstance>;
  switchInstance: (instanceId: string) => Promise<void>;
  removeInstance: (instanceId: string) => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [instances, setInstances] = useState<SavedInstance[]>([]);
  const [currentInstanceId, setCurrentInstanceId] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  const currentInstance = useMemo(
    () => instances.find((instance) => instance.id === currentInstanceId) ?? null,
    [currentInstanceId, instances]
  );

  useEffect(() => {
    setUnauthorizedHandler(() => {
      void clearCurrentInstanceAuth();
    });

    return () => setUnauthorizedHandler(null);
  }, [currentInstanceId, instances]);

  useEffect(() => {
    void bootstrap();
  }, []);

  useEffect(() => {
    setApiBaseUrl(currentInstance?.apiBaseUrl ?? null);
    setApiToken(currentInstance?.authToken ?? null);
  }, [currentInstance?.apiBaseUrl, currentInstance?.authToken]);

  async function bootstrap() {
    try {
      let storedInstances = await loadStoredInstances();
      let currentId = await getStoredCurrentInstanceId();

      if (!storedInstances.length) {
        const migrated = await migrateLegacyInstance();
        if (migrated) {
          storedInstances = [toStoredInstance(migrated)];
          currentId = migrated.id;
          await saveStoredInstances(storedInstances);
          await setStoredCurrentInstanceId(migrated.id);
        }
      }

      const hydrated = await Promise.all(
        storedInstances.map(async (instance) => ({
          ...instance,
          authToken: await getStoredToken(instance.id),
        }))
      );

      setInstances(hydrated);

      const nextCurrentId =
        currentId && hydrated.some((instance) => instance.id === currentId)
          ? currentId
          : hydrated[0]?.id ?? null;

      setCurrentInstanceId(nextCurrentId);

      if (nextCurrentId) {
        await setStoredCurrentInstanceId(nextCurrentId);
        await ensureCurrentInstanceUser(nextCurrentId, hydrated);
      } else {
        await clearStoredCurrentInstanceId();
      }
    } finally {
      setIsReady(true);
    }
  }

  async function migrateLegacyInstance() {
    const configuredApiBaseUrl = getBootstrapApiBaseUrl();
    if (!configuredApiBaseUrl) {
      return null;
    }

    try {
      const normalized = normalizeInstanceUrl(apiBaseToBaseUrl(configuredApiBaseUrl));
      const summary = await getPublicInstanceSummary({ apiBaseUrl: normalized.apiBaseUrl });
      const instance = toSavedInstance(
        normalized.baseUrl,
        normalized.apiBaseUrl,
        normalized.domain,
        summary
      );

      const legacyToken = await getLegacyStoredToken();
      if (legacyToken) {
        await setStoredToken(instance.id, legacyToken);
        instance.authToken = legacyToken;

        try {
          instance.currentUser = await getCurrentUser({
            apiBaseUrl: instance.apiBaseUrl,
            token: legacyToken,
          });
        } catch {
          await clearStoredToken(instance.id);
          instance.authToken = null;
          instance.currentUser = null;
        }

        await clearLegacyStoredToken();
      }

      return instance;
    } catch {
      return null;
    }
  }

  async function persistInstances(nextInstances: SavedInstance[], nextCurrentId?: string | null) {
    setInstances(nextInstances);
    await saveStoredInstances(nextInstances.map(toStoredInstance));

    const resolvedCurrentId = nextCurrentId === undefined ? currentInstanceId : nextCurrentId;
    if (resolvedCurrentId) {
      setCurrentInstanceId(resolvedCurrentId);
      await setStoredCurrentInstanceId(resolvedCurrentId);
    } else {
      setCurrentInstanceId(null);
      await clearStoredCurrentInstanceId();
    }
  }

  async function ensureCurrentInstanceUser(
    instanceId: string,
    sourceInstances: SavedInstance[] = instances
  ) {
    const instance = sourceInstances.find((item) => item.id === instanceId);
    if (!instance?.authToken) {
      return;
    }

    try {
      const user = await getCurrentUser({
        apiBaseUrl: instance.apiBaseUrl,
        token: instance.authToken,
      });

      const nextInstances = sourceInstances.map((item) =>
        item.id === instanceId ? { ...item, currentUser: user } : item
      );
      await persistInstances(nextInstances, instanceId);
    } catch {
      const nextInstances = sourceInstances.map((item) =>
        item.id === instanceId ? { ...item, authToken: null, currentUser: null } : item
      );
      await clearStoredToken(instanceId);
      await persistInstances(nextInstances, instanceId);
    }
  }

  async function clearCurrentInstanceAuth() {
    if (!currentInstanceId) {
      return;
    }

    const nextInstances = instances.map((instance) =>
      instance.id === currentInstanceId
        ? { ...instance, authToken: null, currentUser: null }
        : instance
    );

    await clearStoredToken(currentInstanceId);
    await persistInstances(nextInstances, currentInstanceId);
    await queryClient.invalidateQueries({ queryKey: ["instance", currentInstanceId] });
  }

  async function addInstance(inputUrl: string) {
    const instance = await resolveInstanceFromInput(inputUrl);

    if (instances.some((item) => item.apiBaseUrl === instance.apiBaseUrl)) {
      throw new Error("That instance is already saved.");
    }

    const nextInstances = [...instances, instance];
    await persistInstances(nextInstances, instance.id);
    return instance;
  }

  async function switchInstance(instanceId: string) {
    const next = instances.find((instance) => instance.id === instanceId);
    if (!next || next.id === currentInstanceId) {
      return;
    }

    const nextInstances = instances.map((instance) =>
      instance.id === instanceId
        ? { ...instance, lastUsedAt: new Date().toISOString() }
        : instance
    );

    await persistInstances(nextInstances, instanceId);

    const switched = nextInstances.find((instance) => instance.id === instanceId);
    if (switched?.authToken && !switched.currentUser) {
      await ensureCurrentInstanceUser(instanceId, nextInstances);
    }
  }

  async function removeInstance(instanceId: string) {
    await clearStoredToken(instanceId);

    const nextInstances = instances.filter((instance) => instance.id !== instanceId);
    const nextCurrentId =
      currentInstanceId === instanceId ? nextInstances[0]?.id ?? null : currentInstanceId;

    await persistInstances(nextInstances, nextCurrentId);
  }

  async function login(username: string, password: string) {
    if (!currentInstance) {
      throw new Error("Add an instance before logging in.");
    }

    const response = await loginRequest(username, password, {
      apiBaseUrl: currentInstance.apiBaseUrl,
    });

    await setStoredToken(currentInstance.id, response.token);

    const nextInstances = instances.map((instance) =>
      instance.id === currentInstance.id
        ? {
            ...instance,
            authToken: response.token,
            currentUser: response.user,
            lastUsedAt: new Date().toISOString(),
          }
        : instance
    );

    await persistInstances(nextInstances, currentInstance.id);
    await refreshCurrentInstanceSummary(currentInstance.id, nextInstances);
  }

  async function logout() {
    if (!currentInstance) {
      return;
    }

    try {
      if (currentInstance.authToken) {
        await logoutRequest({
          apiBaseUrl: currentInstance.apiBaseUrl,
          token: currentInstance.authToken,
        });
      }
    } catch {
      // Ignore and clear local state.
    }

    await clearCurrentInstanceAuth();
  }

  async function refreshCurrentInstanceSummary(
    instanceId: string,
    sourceInstances: SavedInstance[] = instances
  ) {
    const instance = sourceInstances.find((item) => item.id === instanceId);
    if (!instance) {
      return;
    }

    try {
      const summary = await getPublicInstanceSummary({ apiBaseUrl: instance.apiBaseUrl });
      const nextInstances = sourceInstances.map((item) =>
        item.id === instanceId ? mergeSummary(item, summary) : item
      );
      await persistInstances(nextInstances, instanceId);
    } catch {
      // Keep the saved instance even if the summary refresh fails.
    }
  }

  const value = useMemo<AuthContextValue>(
    () => ({
      user: currentInstance?.currentUser ?? null,
      token: currentInstance?.authToken ?? null,
      isReady,
      instances,
      currentInstance,
      addInstance,
      switchInstance,
      removeInstance,
      login,
      logout,
    }),
    [currentInstance, instances, isReady]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}

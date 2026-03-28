import AsyncStorage from "@react-native-async-storage/async-storage";
import { getPublicInstanceSummary } from "@/api/instance";
import { getConfiguredApiBaseUrl } from "@/lib/config";
import type { InstanceSummary, User } from "@/api/types";

export interface SavedInstance {
  id: string;
  baseUrl: string;
  apiBaseUrl: string;
  domain: string;
  instanceName: string;
  instanceDescription: string | null;
  totalPublicPosts: number;
  primaryProfile: InstanceSummary["primary_profile"];
  currentUser: User | null;
  authToken: string | null;
  lastUsedAt: string;
}

type StoredInstance = Omit<SavedInstance, "authToken">;

const INSTANCES_KEY = "xlog.mobile.instances";
const CURRENT_INSTANCE_KEY = "xlog.mobile.currentInstanceId";

export async function loadStoredInstances() {
  const raw = await AsyncStorage.getItem(INSTANCES_KEY);
  if (!raw) {
    return [] as StoredInstance[];
  }

  try {
    const parsed = JSON.parse(raw) as StoredInstance[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveStoredInstances(instances: StoredInstance[]) {
  return AsyncStorage.setItem(INSTANCES_KEY, JSON.stringify(instances));
}

export function getStoredCurrentInstanceId() {
  return AsyncStorage.getItem(CURRENT_INSTANCE_KEY);
}

export function setStoredCurrentInstanceId(instanceId: string) {
  return AsyncStorage.setItem(CURRENT_INSTANCE_KEY, instanceId);
}

export function clearStoredCurrentInstanceId() {
  return AsyncStorage.removeItem(CURRENT_INSTANCE_KEY);
}

export function normalizeInstanceUrl(input: string) {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("Enter an instance URL.");
  }

  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : `${isLocalHost(trimmed) ? "http" : "https"}://${trimmed}`;

  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    throw new Error("Enter a valid instance URL.");
  }

  if (!/^https?:$/.test(url.protocol)) {
    throw new Error("Only http and https instance URLs are supported.");
  }

  if (url.protocol === "http:" && !isLocalHost(url.hostname)) {
    throw new Error("Use https for non-local instances.");
  }

  url.hash = "";
  url.search = "";

  let pathname = url.pathname.replace(/\/+$/, "");
  if (pathname.endsWith("/api")) {
    pathname = pathname.slice(0, -4);
  }

  const baseUrl = `${url.origin}${pathname}`;
  const cleanBaseUrl = baseUrl.replace(/\/+$/, "");

  return {
    baseUrl: cleanBaseUrl,
    apiBaseUrl: `${cleanBaseUrl}/api`,
    domain: url.host,
  };
}

export async function resolveInstanceFromInput(inputUrl: string) {
  const normalized = normalizeInstanceUrl(inputUrl);
  const summary = await getPublicInstanceSummary({ apiBaseUrl: normalized.apiBaseUrl });

  return toSavedInstance(normalized.baseUrl, normalized.apiBaseUrl, normalized.domain, summary);
}

export function toSavedInstance(
  baseUrl: string,
  apiBaseUrl: string,
  domain: string,
  summary: InstanceSummary
): SavedInstance {
  return {
    id: createInstanceId(baseUrl),
    baseUrl,
    apiBaseUrl,
    domain,
    instanceName: summary.instance_name,
    instanceDescription: summary.instance_description,
    totalPublicPosts: summary.total_public_posts,
    primaryProfile: summary.primary_profile,
    currentUser: null,
    authToken: null,
    lastUsedAt: new Date().toISOString(),
  };
}

export function mergeSummary(instance: SavedInstance, summary: InstanceSummary): SavedInstance {
  return {
    ...instance,
    instanceName: summary.instance_name,
    instanceDescription: summary.instance_description,
    totalPublicPosts: summary.total_public_posts,
    primaryProfile: summary.primary_profile,
  };
}

export function toStoredInstance(instance: SavedInstance): StoredInstance {
  const { authToken: _authToken, ...rest } = instance;
  return rest;
}

export function getBootstrapApiBaseUrl() {
  return getConfiguredApiBaseUrl();
}

export function apiBaseToBaseUrl(apiBaseUrl: string) {
  return apiBaseUrl.replace(/\/api\/?$/, "");
}

function createInstanceId(baseUrl: string) {
  return baseUrl.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function isLocalHost(value: string) {
  return /^(localhost|127(?:\.\d{1,3}){3}|10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2})(:\d+)?(\/|$)/i.test(value)
    || /^(localhost|127(?:\.\d{1,3}){3}|10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2})$/i.test(value);
}

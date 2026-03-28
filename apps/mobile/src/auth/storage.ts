import * as SecureStore from "expo-secure-store";

const LEGACY_TOKEN_KEY = "xlog.mobile.token";

function tokenKey(instanceId: string) {
  return `xlog.mobile.token.${instanceId}`;
}

export function getStoredToken(instanceId: string) {
  return SecureStore.getItemAsync(tokenKey(instanceId));
}

export function setStoredToken(instanceId: string, token: string) {
  return SecureStore.setItemAsync(tokenKey(instanceId), token);
}

export function clearStoredToken(instanceId: string) {
  return SecureStore.deleteItemAsync(tokenKey(instanceId));
}

export function getLegacyStoredToken() {
  return SecureStore.getItemAsync(LEGACY_TOKEN_KEY);
}

export function clearLegacyStoredToken() {
  return SecureStore.deleteItemAsync(LEGACY_TOKEN_KEY);
}

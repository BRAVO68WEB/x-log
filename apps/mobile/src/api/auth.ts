import { apiRequest, type RequestContext } from "@/api/client";
import type { MobileAuthResponse, User } from "@/api/types";

export async function login(username: string, password: string, context?: RequestContext) {
  return apiRequest<MobileAuthResponse>("/auth/mobile/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  }, context);
}

export async function logout(context?: RequestContext) {
  return apiRequest<{ message: string }>("/auth/mobile/logout", {
    method: "POST",
  }, context);
}

export async function getCurrentUser(context?: RequestContext) {
  return apiRequest<User>("/users/me", undefined, context);
}

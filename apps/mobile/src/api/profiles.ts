import { apiRequest, type RequestContext } from "@/api/client";
import type { Profile } from "./types";

export function getProfile(username: string, context?: RequestContext) {
  return apiRequest<Profile>(`/profiles/${username}`, undefined, context);
}

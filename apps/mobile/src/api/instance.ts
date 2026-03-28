import { apiRequest, type RequestContext } from "@/api/client";
import type { InstanceSummary } from "@/api/types";

export function getPublicInstanceSummary(context?: RequestContext) {
  return apiRequest<InstanceSummary>("/public/instance", undefined, context);
}

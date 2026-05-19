import { apiRequest, type RequestContext } from "@/api/client";
import type { InstanceThemeId } from "@/theme/palettes";

export function updateInstanceSettings(
  data: { theme_id: InstanceThemeId },
  context?: RequestContext
) {
  return apiRequest<{ theme_id: InstanceThemeId }>(
    "/settings",
    {
      method: "PATCH",
      body: JSON.stringify(data),
    },
    context
  );
}

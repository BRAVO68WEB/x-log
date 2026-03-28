import { apiRequest, type RequestContext } from "@/api/client";

export async function uploadImageAsync(asset: {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
}, context?: RequestContext) {
  const formData = new FormData();
  formData.append("asset_type", "post_attachment");
  formData.append("file", {
    uri: asset.uri,
    name: asset.fileName || `image-${Date.now()}.jpg`,
    type: asset.mimeType || "image/jpeg",
  } as any);

  return apiRequest<{ url: string }>("/media/upload", {
    method: "POST",
    body: formData,
  }, context);
}

export async function uploadBannerAsync(asset: {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
}, context?: RequestContext) {
  const formData = new FormData();
  formData.append("asset_type", "banner");
  formData.append("file", {
    uri: asset.uri,
    name: asset.fileName || `banner-${Date.now()}.jpg`,
    type: asset.mimeType || "image/jpeg",
  } as any);

  return apiRequest<{ url: string }>("/media/upload", {
    method: "POST",
    body: formData,
  }, context);
}

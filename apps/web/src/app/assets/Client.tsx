"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "react-query";
import { mediaApi, type MediaItem } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import toast, { Toaster } from "react-hot-toast";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AssetsClient() {
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);

  const { data, isLoading } = useQuery("media-list", () => mediaApi.list());

  const deleteMutation = useMutation(
    (filename: string) => mediaApi.delete(filename),
    {
      onSuccess: () => {
        queryClient.invalidateQueries("media-list");
        toast.success("File deleted");
      },
      onError: (err) => {
        toast.error(err instanceof Error ? err.message : "Delete failed");
      },
    }
  );

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploading(true);
      await mediaApi.upload(file);
      queryClient.invalidateQueries("media-list");
      toast.success("File uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleCopyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("URL copied to clipboard");
    } catch {
      toast.error("Failed to copy URL");
    }
  };

  const handleDelete = (item: MediaItem) => {
    if (confirm(`Delete "${item.filename}"? This cannot be undone.`)) {
      deleteMutation.mutate(item.filename);
    }
  };

  const items = data?.items || [];

  return (
    <main className="min-h-screen py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold font-heading">Assets</h1>
          <div className="flex items-center gap-2">
            <label
              htmlFor="asset-upload"
              className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 cursor-pointer"
            >
              {uploading ? "Uploading..." : "Upload"}
            </label>
            <input
              id="asset-upload"
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              onChange={handleUpload}
              disabled={uploading}
              className="sr-only"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center min-h-[300px]">
            <LoadingSpinner size="lg" />
          </div>
        ) : items.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <p className="text-muted-foreground text-lg">
                No assets uploaded yet. Upload your first image to get started.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {items.map((item) => (
              <Card key={item.filename} className="overflow-hidden group">
                <div className="relative aspect-square bg-muted">
                  <Image
                    src={item.url}
                    alt={item.filename}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </div>
                <CardContent className="p-3">
                  <p className="text-sm font-medium truncate mb-1" title={item.filename}>
                    {item.filename}
                  </p>
                  <div className="flex items-center gap-2 mb-1">
                    {item.asset_type === "banner" ? (
                      <Badge variant="secondary" className="text-xs">Banner</Badge>
                    ) : item.asset_type === "post_attachment" ? (
                      <Badge variant="outline" className="text-xs">Attachment</Badge>
                    ) : null}
                    <span className="text-xs text-muted-foreground">
                      {formatBytes(item.size)}
                    </span>
                  </div>
                  <div className="mb-3">
                    {item.post_id && item.post_title ? (
                      <Link
                        href={`/post/${item.post_id}`}
                        className="text-xs text-primary hover:underline truncate block"
                        title={item.post_title}
                      >
                        {item.post_title}
                      </Link>
                    ) : (
                      <span className="text-xs text-muted-foreground">Unlinked</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleCopyUrl(item.url)}
                    >
                      Copy URL
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDelete(item)}
                      disabled={deleteMutation.isLoading}
                    >
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
      <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
    </main>
  );
}

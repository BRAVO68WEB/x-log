"use client";

import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { postMetaApi } from "@/lib/api";
import { ChevronDown, ChevronRight, Plus, X, Save } from "lucide-react";

const SUGGESTED_KEYS = [
  "og:image",
  "og:description",
  "twitter:card",
  "twitter:image",
  "canonical",
  "robots",
  "custom:tracking_id",
];

interface PostMetaPanelProps {
  postId: string;
}

export default function PostMetaPanel({ postId }: PostMetaPanelProps) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [meta, setMeta] = useState<Record<string, string>>({});
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [dirty, setDirty] = useState(false);

  const { data, isLoading } = useQuery(
    ["post-meta", postId],
    () => postMetaApi.get(postId),
    { enabled: expanded && !!postId }
  );

  useEffect(() => {
    if (data?.meta) {
      setMeta(data.meta);
      setDirty(false);
    }
  }, [data]);

  const saveMutation = useMutation(
    () => postMetaApi.bulkUpdate(postId, meta),
    {
      onSuccess: () => {
        setDirty(false);
        queryClient.invalidateQueries(["post-meta", postId]);
      },
    }
  );

  const deleteMutation = useMutation(
    (key: string) => postMetaApi.delete(postId, key),
    {
      onSuccess: (_, key) => {
        setMeta((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
        setDirty(true);
      },
    }
  );

  const handleAdd = () => {
    const key = newKey.trim();
    const value = newValue.trim();
    if (!key) return;
    setMeta((prev) => ({ ...prev, [key]: value }));
    setNewKey("");
    setNewValue("");
    setDirty(true);
  };

  const handleChange = useCallback((key: string, value: string) => {
    setMeta((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  }, []);

  const handleRemove = (key: string) => {
    if (data?.meta?.[key]) {
      deleteMutation.mutate(key);
    } else {
      setMeta((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      setDirty(true);
    }
  };

  const entries = Object.entries(meta);

  return (
    <div className="border rounded-lg">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full p-3 text-sm font-medium hover:bg-accent/50 transition-colors"
      >
        <span>Custom Metadata</span>
        {expanded ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
      </button>

      {expanded && (
        <div className="p-3 border-t space-y-3">
          {isLoading ? (
            <div className="flex justify-center py-4">
              <LoadingSpinner size="sm" />
            </div>
          ) : (
            <>
              {entries.length > 0 && (
                <div className="space-y-2">
                  {entries.map(([key, value]) => (
                    <div key={key} className="flex gap-2 items-start">
                      <div className="flex-1 space-y-1">
                        <Input
                          value={key}
                          readOnly
                          className="text-xs font-mono bg-muted"
                        />
                        <Input
                          value={value}
                          onChange={(e) => handleChange(key, e.target.value)}
                          className="text-xs"
                          placeholder="Value"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemove(key)}
                        className="mt-1"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    value={newKey}
                    onChange={(e) => setNewKey(e.target.value)}
                    placeholder="Key"
                    className="text-xs font-mono"
                    list="meta-key-suggestions"
                  />
                  <Input
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                    placeholder="Value"
                    className="text-xs"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAdd();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAdd}
                    disabled={!newKey.trim()}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
                <datalist id="meta-key-suggestions">
                  {SUGGESTED_KEYS.map((k) => (
                    <option key={k} value={k} />
                  ))}
                </datalist>
              </div>

              {dirty && (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => saveMutation.mutate()}
                  disabled={saveMutation.isLoading}
                  className="w-full"
                >
                  {saveMutation.isLoading ? (
                    <LoadingSpinner size="sm" />
                  ) : (
                    <>
                      <Save className="h-3 w-3 mr-1" />
                      Save Metadata
                    </>
                  )}
                </Button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

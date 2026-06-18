"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { aiApi } from "@/lib/api";
import {
  Wand2,
  ArrowUpDown,
  Minimize2,
  Sparkles,
  Languages,
  Type,
  CheckCircle,
} from "lucide-react";

interface AIToolbarProps {
  selectedText: string;
  onReplace: (newText: string) => void;
  onAppend: (text: string) => void;
  fullContent: string;
  onTitleGenerated?: (title: string) => void;
  onMetaGenerated?: (meta: { title: string; description: string; tags: string[] }) => void;
}

type AIAction = "expand" | "condense" | "engaging" | "fix-grammar";

const LANGUAGES = [
  "Spanish", "French", "German", "Chinese", "Japanese", "Korean",
  "Portuguese", "Italian", "Russian", "Arabic", "Hindi",
];

export default function AIToolbar({
  selectedText,
  onReplace,
  onAppend,
  fullContent,
  onTitleGenerated,
  onMetaGenerated,
}: AIToolbarProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showLanguages, setShowLanguages] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [resultAction, setResultAction] = useState<string | null>(null);

  const handleEnhance = async (action: AIAction) => {
    const text = selectedText || fullContent;
    if (!text.trim()) return;

    setLoading(action);
    setError(null);
    setResult(null);
    try {
      const res = await aiApi.enhance(text, action);
      setResult(res.content);
      setResultAction(action);
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI request failed");
    } finally {
      setLoading(null);
    }
  };

  const handleTranslate = async (language: string) => {
    const text = selectedText || fullContent;
    if (!text.trim()) return;

    setLoading(`translate-${language}`);
    setError(null);
    setResult(null);
    setShowLanguages(false);
    try {
      const res = await aiApi.translate(text, language);
      setResult(res.content);
      setResultAction(`translate-${language}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Translation failed");
    } finally {
      setLoading(null);
    }
  };

  const handleGenerateTitle = async () => {
    if (!fullContent.trim()) return;
    setLoading("title");
    setError(null);
    try {
      const res = await aiApi.generateTitle(fullContent);
      onTitleGenerated?.(res.title);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Title generation failed");
    } finally {
      setLoading(null);
    }
  };

  const handleGenerateMeta = async () => {
    if (!fullContent.trim()) return;
    setLoading("meta");
    setError(null);
    try {
      const res = await aiApi.generateMeta(fullContent);
      onMetaGenerated?.(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Meta generation failed");
    } finally {
      setLoading(null);
    }
  };

  const handleAccept = () => {
    if (!result) return;
    if (selectedText) {
      onReplace(result);
    } else {
      onAppend(result);
    }
    setResult(null);
    setResultAction(null);
  };

  const handleDismiss = () => {
    setResult(null);
    setResultAction(null);
  };

  return (
    <div className="space-y-3">
      {/* AI action buttons */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
          <Wand2 className="h-3 w-3" /> AI
        </span>

        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={() => handleEnhance("engaging")}
          disabled={loading !== null}
        >
          {loading === "engaging" ? <LoadingSpinner size="sm" /> : <Sparkles className="h-3 w-3 mr-1" />}
          Enhance
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={() => handleEnhance("expand")}
          disabled={loading !== null}
        >
          {loading === "expand" ? <LoadingSpinner size="sm" /> : <ArrowUpDown className="h-3 w-3 mr-1" />}
          Expand
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={() => handleEnhance("condense")}
          disabled={loading !== null}
        >
          {loading === "condense" ? <LoadingSpinner size="sm" /> : <Minimize2 className="h-3 w-3 mr-1" />}
          Condense
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={() => handleEnhance("fix-grammar")}
          disabled={loading !== null}
        >
          {loading === "fix-grammar" ? <LoadingSpinner size="sm" /> : <CheckCircle className="h-3 w-3 mr-1" />}
          Fix Grammar
        </Button>

        <div className="relative">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setShowLanguages(!showLanguages)}
            disabled={loading !== null}
          >
            {loading?.startsWith("translate") ? <LoadingSpinner size="sm" /> : <Languages className="h-3 w-3 mr-1" />}
            Translate
          </Button>
          {showLanguages && (
            <div className="absolute top-full left-0 mt-1 z-50 w-40 rounded-md border bg-card shadow-md max-h-60 overflow-y-auto">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang}
                  onClick={() => handleTranslate(lang)}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-accent transition-colors"
                >
                  {lang}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="w-px h-5 bg-border mx-1" />

        {onTitleGenerated && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={handleGenerateTitle}
            disabled={loading !== null}
          >
            {loading === "title" ? <LoadingSpinner size="sm" /> : <Type className="h-3 w-3 mr-1" />}
            Gen Title
          </Button>
        )}

        {onMetaGenerated && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={handleGenerateMeta}
            disabled={loading !== null}
          >
            {loading === "meta" ? <LoadingSpinner size="sm" /> : <Sparkles className="h-3 w-3 mr-1" />}
            Gen Meta
          </Button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-md bg-destructive/10 p-2 border border-destructive/20">
          <p className="text-xs text-destructive">{error}</p>
        </div>
      )}

      {/* Result preview */}
      {result && (
        <div className="rounded-md border bg-card p-3 space-y-2">
          <p className="text-xs text-muted-foreground font-medium">
            AI suggestion ({resultAction}):
          </p>
          <div className="text-sm max-h-48 overflow-y-auto whitespace-pre-wrap">{result}</div>
          <div className="flex gap-2">
            <Button size="sm" className="h-7 text-xs" onClick={handleAccept}>
              {selectedText ? "Replace selected" : "Append to content"}
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={handleDismiss}>
              Dismiss
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Extension } from "@tiptap/core";
import TiptapImage from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import { createLowlight } from "lowlight";
import TurndownService from "turndown";
import { useState, useRef, useEffect } from "react";
import NextImage from "next/image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { LoadingSpinner } from "./LoadingSpinner";
import type { Editor as TipTapEditor, JSONContent } from "@tiptap/core";
import { renderMarkdownSync } from "@xlog/markdown";
import toast from "react-hot-toast";
import { useMutation } from "react-query";

// Swap Enter and Cmd+Enter behavior:
//   Enter       → hard break (<br>, new line in same paragraph)
//   Cmd+Enter   → new paragraph (splitBlock)
const SwapEnterKeys = Extension.create({
  name: "swapEnterKeys",
  addKeyboardShortcuts() {
    return {
      Enter: ({ editor }) => editor.commands.setHardBreak(),
      "Mod-Enter": ({ editor }) =>
        editor.commands.splitBlock(),
    };
  },
});

const lowlight = createLowlight();

const turndownService = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
});

// Turndown rules for GFM tables
// Handles both standard HTML tables (<thead>/<tbody>) and TipTap tables
// (all rows in <tbody>, header row uses <th> cells)
turndownService.addRule("tableCell", {
  filter: ["th", "td"],
  replacement(content) {
    return ` ${content.trim().replace(/\|/g, "\\|").replace(/\n/g, " ")} |`;
  },
});

turndownService.addRule("tableRow", {
  filter: "tr",
  replacement(content, node) {
    const row = `|${content}\n`;
    // Detect header row: direct <th> children (works for both <thead> and TipTap style)
    const cells = Array.from(node.childNodes);
    const isHeaderRow = cells.some(
      (child) => (child as Element).tagName === "TH"
    );
    if (isHeaderRow) {
      const cols = (content.match(/\|/g) || []).length;
      const separator = "|" + " --- |".repeat(cols);
      return `${row}${separator}\n`;
    }
    return row;
  },
});

turndownService.addRule("tableSection", {
  filter: ["thead", "tbody", "tfoot"],
  replacement(content) {
    return content;
  },
});

turndownService.addRule("table", {
  filter: "table",
  replacement(content) {
    return `\n${content}\n`;
  },
});

interface EditorProps {
  initialContent?: JSONContent | string;
  onSave?: (
    content: JSONContent | string,
    markdown: string,
    bannerUrl?: string
  ) => void;
  onPublish?: (
    content: JSONContent | string,
    markdown: string,
    title: string,
    hashtags: string[],
    bannerUrl?: string,
    summary?: string
  ) => void;
  saving?: boolean;
}

export function Editor({
  initialContent,
  onSave,
  onPublish,
  saving = false,
}: EditorProps) {
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [hashtagInput, setHashtagInput] = useState("");
  const editorRef = useRef<TipTapEditor | null>(null);

  const [bannerImage, setBannerImage] = useState<string>("");
  const [bannerUrl, setBannerUrl] = useState<string>("");
  const [bannerUploading, setBannerUploading] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);

  const uploadImageMutation = useMutation(async (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`/api/media/upload`, {
      method: "POST",
      credentials: "include",
      body: fd,
    });
    if (!res.ok) {
      const err = await res
        .json()
        .catch(() => ({ error: "Upload failed" }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return (await res.json()) as { url: string };
  });

  const uploadBannerMutation = useMutation(async (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`/api/media/upload`, {
      method: "POST",
      credentials: "include",
      body: fd,
    });
    if (!res.ok) {
      const err = await res
        .json()
        .catch(() => ({ error: "Upload failed" }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return (await res.json()) as { url: string };
  });

  const handleBannerUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setBannerUploading(true);
      const preview = URL.createObjectURL(file);
      setBannerImage(preview);
      const res = await uploadBannerMutation.mutateAsync(file);
      setBannerUrl(res.url);
      toast.success("Banner uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
      setBannerImage("");
      setBannerUrl("");
    } finally {
      setBannerUploading(false);
    }
  };

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
        hardBreak: {
          keepMarks: true,
        },
      }),
      CodeBlockLowlight.configure({
        lowlight,
      }),
      Table.configure({
        resizable: false,
        HTMLAttributes: { class: "table" },
      }),
      TableRow,
      TableCell,
      TableHeader,
      SwapEnterKeys,
      TiptapImage.configure({
        inline: true,
        allowBase64: true,
      }),
      Link.configure({
        openOnClick: false,
      }),
      Placeholder.configure({
        placeholder: "Start writing...",
      }),
    ],
    content: initialContent || "",
    editorProps: {
      attributes: {
        class:
          "prose prose-lg max-w-none focus:outline-none min-h-[600px] p-6",
      },
      handlePaste: (view, event) => {
        const clipboardData = event.clipboardData;
        if (!clipboardData) return false;

        const currentEditor = editorRef.current;
        if (!currentEditor) return false;

        const items = Array.from(clipboardData.items);
        const imageItem = items.find((item) =>
          item.type.startsWith("image/")
        );

        if (imageItem) {
          event.preventDefault();
          const file = imageItem.getAsFile();
          if (file) {
            setImageUploading(true);
            uploadImageMutation.mutate(file, {
              onSuccess: (res) => {
                currentEditor
                  .chain()
                  .focus()
                  .setImage({ src: res.url })
                  .run();
                toast.success("Image uploaded");
                setImageUploading(false);
              },
              onError: (err) => {
                toast.error(
                  err instanceof Error
                    ? err.message
                    : "Image upload failed"
                );
                setImageUploading(false);
              },
            });
          }
          return true;
        }

        const html = clipboardData.getData("text/html");
        if (html) {
          const base64ImageRegex =
            /<img[^>]+src=["'](data:image\/[^"']+)["'][^>]*>/gi;
          const matches = Array.from(html.matchAll(base64ImageRegex));

          if (matches.length > 0) {
            event.preventDefault();
            setImageUploading(true);

            (async () => {
              try {
                let processedHtml = html;

                for (const match of matches) {
                  const base64Data = match[1];
                  try {
                    const response = await fetch(base64Data);
                    const blob = await response.blob();
                    const file = new File(
                      [blob],
                      `pasted-image-${Date.now()}.png`,
                      { type: blob.type }
                    );

                    const uploadRes =
                      await uploadImageMutation.mutateAsync(file);
                    processedHtml = processedHtml.replace(
                      base64Data,
                      uploadRes.url
                    );
                  } catch (err) {
                    console.error("Failed to upload pasted image:", err);
                  }
                }

                currentEditor
                  .chain()
                  .focus()
                  .insertContent(processedHtml)
                  .run();
                toast.success("Images uploaded");
              } catch (err) {
                toast.error(
                  err instanceof Error
                    ? err.message
                    : "Failed to process images"
                );
              } finally {
                setImageUploading(false);
              }
            })();

            return true;
          }
        }

        const text = clipboardData.getData("text/plain");
        if (!text) return false;

        const codeBlockRegex = /```[\s\S]*?```/g;
        const codeMatches = Array.from(text.matchAll(codeBlockRegex));

        if (codeMatches.length > 1) {
          event.preventDefault();

          const currentEditor = editorRef.current;
          if (!currentEditor) return false;

          const parts: Array<{
            type: "text" | "code";
            content: string;
            language?: string;
          }> = [];
          let lastIndex = 0;

          for (const match of codeMatches) {
            const matchIndex = match.index ?? 0;
            const matchText = match[0];

            if (matchIndex > lastIndex) {
              const textBefore = text
                .slice(lastIndex, matchIndex)
                .trim();
              if (textBefore) {
                parts.push({ type: "text", content: textBefore });
              }
            }

            const codeBlockMatch = matchText.match(
              /```(\w+)?\n?([\s\S]*?)```/
            );
            if (codeBlockMatch) {
              const language = codeBlockMatch[1] || "";
              const codeContent = codeBlockMatch[2].trim();
              parts.push({
                type: "code",
                content: codeContent,
                language,
              });
            }

            lastIndex = matchIndex + matchText.length;
          }

          if (lastIndex < text.length) {
            const textAfter = text.slice(lastIndex).trim();
            if (textAfter) {
              parts.push({ type: "text", content: textAfter });
            }
          }

          let chain = currentEditor.chain().focus();

          parts.forEach((part, index) => {
            if (part.type === "code") {
              chain = chain.insertContent({
                type: "codeBlock",
                attrs: part.language
                  ? { language: part.language }
                  : {},
                content: part.content
                  ? [{ type: "text", text: part.content }]
                  : [],
              });

              if (index < parts.length - 1) {
                chain = chain.insertContent({ type: "paragraph" });
              }
            } else {
              try {
                const htmlContent = renderMarkdownSync(part.content);
                chain = chain.insertContent(htmlContent);
              } catch (error) {
                console.error("Markdown parsing error:", error);
                const paragraphs = part.content
                  .split(/\n\n+/)
                  .filter((p) => p.trim());
                paragraphs.forEach((para, paraIndex) => {
                  if (paraIndex > 0) {
                    chain = chain.insertContent({
                      type: "paragraph",
                    });
                  }
                  chain = chain.insertContent(para.trim());
                });
              }
            }
          });

          chain.run();
          return true;
        }

        const markdownPatterns = [
          /^#{1,6}\s/m,
          /\*\*.*?\*\*/,
          /\*.*?\*/,
          /^\s*[-*+]\s/m,
          /^\s*\d+\.\s/m,
          /```[\s\S]*?```/,
          /\[.*?\]\(.*?\)/,
          /!\[.*?\]\(.*?\)/,
        ];

        const hasMarkdownSyntax = markdownPatterns.some((pattern) =>
          pattern.test(text)
        );

        if (hasMarkdownSyntax) {
          event.preventDefault();

          const currentEditor = editorRef.current;
          if (!currentEditor) return false;

          try {
            const htmlContent = renderMarkdownSync(text);
            currentEditor
              .chain()
              .focus()
              .insertContent(htmlContent)
              .run();
            return true;
          } catch (error) {
            console.error("Markdown parsing error:", error);
            return false;
          }
        }

        return false;
      },
    },
  });

  useEffect(() => {
    if (editor) {
      editorRef.current = editor;
    }
  }, [editor]);

  const handleSave = () => {
    if (!editor || !onSave) return;
    const json = editor.getJSON();
    const html = editor.getHTML();
    const markdown = turndownService.turndown(html);
    onSave(json, markdown, bannerUrl || undefined);
  };

  const handlePublish = () => {
    if (!editor || !onPublish) return;
    const json = editor.getJSON();
    const html = editor.getHTML();
    const markdown = turndownService.turndown(html);
    onPublish(
      json,
      markdown,
      title || "Untitled",
      hashtags,
      bannerUrl || undefined,
      summary || undefined
    );
  };

  const addHashtag = (tag?: string) => {
    const tagToAdd = (tag || hashtagInput)
      .trim()
      .toLowerCase()
      .replace(/^#/, "");
    if (tagToAdd && tagToAdd.length > 0 && !hashtags.includes(tagToAdd)) {
      setHashtags([...hashtags, tagToAdd]);
      setHashtagInput("");
    }
  };

  const removeHashtag = (tag: string) => {
    setHashtags(hashtags.filter((t) => t !== tag));
  };

  const handleHashtagInputChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = e.target.value;
    setHashtagInput(value);

    if (value.includes(",") || value.includes(" ")) {
      const parts = value.split(/[,\s]+/);
      const newTag = parts[0].trim().replace(/^#/, "");
      if (newTag && newTag.length > 0) {
        addHashtag(newTag);
        const remaining = parts.slice(1).join(" ").trim();
        if (remaining) {
          setHashtagInput(remaining);
        }
      }
    }
  };

  const handleHashtagKeyPress = (
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addHashtag();
    }
  };

  if (!editor) {
    return null;
  }

  const ToolbarButton = ({
    onClick,
    active,
    title,
    children,
  }: {
    onClick: () => void;
    active?: boolean;
    title: string;
    children: React.ReactNode;
  }) => (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onClick}
      className={active ? "bg-primary/10 text-primary" : ""}
      title={title}
    >
      {children}
    </Button>
  );

  return (
    <div>
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="mb-8">
          <input
            type="text"
            placeholder="Post title..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-5xl font-bold w-full border-none outline-none bg-transparent font-heading placeholder:text-muted-foreground mb-4"
          />
          <textarea
            placeholder="Write a brief summary or excerpt (optional)..."
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={2}
            className="w-full border-none outline-none bg-transparent text-muted-foreground placeholder:text-muted-foreground mb-6 resize-none text-sm leading-relaxed"
          />

          <div className="flex items-center gap-2">
            <div className="flex flex-wrap items-center gap-2">
              {hashtags.map((tag) => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="gap-1 pl-2.5"
                >
                  <span className="text-primary">#</span>
                  {tag}
                  <button
                    onClick={() => removeHashtag(tag)}
                    className="hover:text-destructive transition-colors ml-1"
                    aria-label={`Remove ${tag}`}
                  >
                    x
                  </button>
                </Badge>
              ))}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Add hashtags..."
                  value={hashtagInput}
                  onChange={handleHashtagInputChange}
                  onKeyPress={handleHashtagKeyPress}
                  className="px-3 py-1.5 border border-input rounded-md text-sm bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <label htmlFor="banner-upload">
                <Button type="button" variant="outline" size="sm" asChild>
                  <span>Upload Banner</span>
                </Button>
              </label>
              <input
                id="banner-upload"
                type="file"
                accept="image/*"
                onChange={handleBannerUpload}
                className="hidden"
              />
              {bannerUploading && (
                <span className="text-sm text-muted-foreground">
                  Uploading...
                </span>
              )}
              {(bannerImage || bannerUrl) && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={() => {
                    if (
                      bannerImage &&
                      bannerImage.startsWith("blob:")
                    ) {
                      URL.revokeObjectURL(bannerImage);
                    }
                    setBannerImage("");
                    setBannerUrl("");
                  }}
                >
                  Remove
                </Button>
              )}
            </div>
          </div>
          {(bannerImage || bannerUrl) && (
            <div className="mt-4 relative w-full h-48">
              <NextImage
                src={bannerUrl || bannerImage}
                alt="Banner"
                fill
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 100vw, 1200px"
                className="object-cover rounded-lg border border-border"
                onError={() => {
                  if (bannerUrl) {
                    setBannerUrl("");
                  }
                }}
                unoptimized
              />
            </div>
          )}
        </div>

        <Card className="overflow-hidden mb-6">
          <div className="border-b border-border px-4 py-3 flex items-center gap-1 flex-wrap bg-muted/50">
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleBold().run()}
              active={editor.isActive("bold")}
              title="Bold"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 12h9a4 4 0 014 4 4 4 0 01-4 4H6z" />
              </svg>
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleItalic().run()}
              active={editor.isActive("italic")}
              title="Italic"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 4h4m-2 0l-4 16m-2 0h4" />
              </svg>
            </ToolbarButton>
            <Separator orientation="vertical" className="mx-1 h-6" />
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
              active={editor.isActive("heading", { level: 1 })}
              title="Heading 1"
            >
              H1
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              active={editor.isActive("heading", { level: 2 })}
              title="Heading 2"
            >
              H2
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
              active={editor.isActive("heading", { level: 3 })}
              title="Heading 3"
            >
              H3
            </ToolbarButton>
            <Separator orientation="vertical" className="mx-1 h-6" />
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              active={editor.isActive("bulletList")}
              title="Bullet List"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 6h13M8 12h13m-13 6h13M3 6h.01M3 12h.01M3 18h.01" />
              </svg>
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              active={editor.isActive("orderedList")}
              title="Numbered List"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
              </svg>
            </ToolbarButton>
            <Separator orientation="vertical" className="mx-1 h-6" />
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleCodeBlock().run()}
              active={editor.isActive("codeBlock")}
              title="Code Block"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
            </ToolbarButton>
            <ToolbarButton
              onClick={() => {
                const url = window.prompt("Enter image URL:");
                if (url) {
                  editor.chain().focus().setImage({ src: url }).run();
                }
              }}
              title="Insert Image"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </ToolbarButton>
            <ToolbarButton
              onClick={() => {
                const url = window.prompt("Enter link URL:");
                if (url) {
                  editor.chain().focus().setLink({ href: url }).run();
                }
              }}
              title="Insert Link"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            </ToolbarButton>
          </div>

          <div className="relative">
            <EditorContent editor={editor} />
            {imageUploading && (
              <div className="absolute top-4 right-4 bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 z-10">
                <LoadingSpinner size="sm" />
                <span className="text-sm font-medium">
                  Uploading image...
                </span>
              </div>
            )}
          </div>
        </Card>

        <div className="flex items-center justify-between gap-4">
          <div className="text-sm text-muted-foreground">
            {editor.state.doc.textContent.length} characters
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save Draft"}
            </Button>
            <Button
              onClick={handlePublish}
              disabled={saving || !title.trim()}
            >
              {saving ? "Publishing..." : "Publish"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

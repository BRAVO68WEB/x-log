"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TiptapImage from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { createLowlight } from "lowlight";
import TurndownService from "turndown";
import { useState, useRef, useEffect } from "react";
import NextImage from "next/image";
import { Button } from "./Button";
import { LoadingSpinner } from "./LoadingSpinner";
import type { Editor as TipTapEditor, JSONContent } from "@tiptap/core";
import { renderMarkdownSync } from "@xlog/markdown";
import toast from "react-hot-toast";
import { useMutation } from "react-query";

const lowlight = createLowlight();

const turndownService = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
});

interface EditorProps {
  initialContent?: JSONContent | string;
  onSave?: (content: JSONContent | string, markdown: string, bannerUrl?: string) => void;
  onPublish?: (content: JSONContent | string, markdown: string, title: string, hashtags: string[], bannerUrl?: string) => void;
  saving?: boolean;
}

export function Editor({ initialContent, onSave, onPublish, saving = false }: EditorProps) {
  const [title, setTitle] = useState("");
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
    const res = await fetch(`/api/media/upload`, { method: "POST", credentials: "include", body: fd });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Upload failed" }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return (await res.json()) as { url: string };
  });

  const uploadBannerMutation = useMutation(async (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`/api/media/upload`, { method: "POST", credentials: "include", body: fd });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Upload failed" }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return (await res.json()) as { url: string };
  });

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
      }),
      CodeBlockLowlight.configure({
        lowlight,
      }),
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
          "prose prose-lg max-w-none focus:outline-none min-h-[600px] p-6 text-light-text dark:text-dark-text",
      },
      handlePaste: (view, event) => {
        const clipboardData = event.clipboardData;
        if (!clipboardData) return false;

        const currentEditor = editorRef.current;
        if (!currentEditor) return false;

        // Check for pasted image files
        const items = Array.from(clipboardData.items);
        const imageItem = items.find((item) => item.type.startsWith("image/"));
        
        if (imageItem) {
          event.preventDefault();
          const file = imageItem.getAsFile();
          if (file) {
            setImageUploading(true);
            // Upload image asynchronously
            uploadImageMutation.mutate(file, {
              onSuccess: (res) => {
                // Insert image at current cursor position
                currentEditor.chain().focus().setImage({ src: res.url }).run();
                toast.success("Image uploaded");
                setImageUploading(false);
              },
              onError: (err) => {
                toast.error(err instanceof Error ? err.message : "Image upload failed");
                setImageUploading(false);
              },
            });
          }
          return true;
        }

        // Check for base64 images in HTML content
        const html = clipboardData.getData("text/html");
        if (html) {
          const base64ImageRegex = /<img[^>]+src=["'](data:image\/[^"']+)["'][^>]*>/gi;
          const matches = Array.from(html.matchAll(base64ImageRegex));
          
          if (matches.length > 0) {
            event.preventDefault();
            setImageUploading(true);
            
            // Process images asynchronously
            (async () => {
              try {
                // Process each base64 image
                let processedHtml = html;
                
                for (const match of matches) {
                  const base64Data = match[1];
                  try {
                    // Convert base64 to File
                    const response = await fetch(base64Data);
                    const blob = await response.blob();
                    const file = new File([blob], `pasted-image-${Date.now()}.png`, { type: blob.type });
                    
                    // Upload image
                    const uploadRes = await uploadImageMutation.mutateAsync(file);
                    
                    // Replace base64 with uploaded URL
                    processedHtml = processedHtml.replace(base64Data, uploadRes.url);
                  } catch (err) {
                    console.error("Failed to upload pasted image:", err);
                    // Keep the base64 image if upload fails
                  }
                }
                
                // Insert processed HTML content
                currentEditor.chain().focus().insertContent(processedHtml).run();
                toast.success("Images uploaded");
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Failed to process images");
              } finally {
                setImageUploading(false);
              }
            })();
            
            return true;
          }
        }

        const text = clipboardData.getData("text/plain");
        if (!text) return false;

        // Check if the pasted content contains markdown code blocks
        const codeBlockRegex = /```[\s\S]*?```/g;
        const matches = Array.from(text.matchAll(codeBlockRegex));
        
        if (matches.length > 1) {
          // Multiple code blocks detected - parse and insert separately
          event.preventDefault();
          
          const currentEditor = editorRef.current;
          if (!currentEditor) return false;
          
          // Split text by code blocks while preserving them
          const parts: Array<{ type: "text" | "code"; content: string; language?: string }> = [];
          let lastIndex = 0;
          
          for (const match of matches) {
            const matchIndex = match.index ?? 0;
            const matchText = match[0];
            
            // Add text before code block
            if (matchIndex > lastIndex) {
              const textBefore = text.slice(lastIndex, matchIndex).trim();
              if (textBefore) {
                parts.push({ type: "text", content: textBefore });
              }
            }
            
            // Extract code block content and language
            const codeBlockMatch = matchText.match(/```(\w+)?\n?([\s\S]*?)```/);
            if (codeBlockMatch) {
              const language = codeBlockMatch[1] || "";
              const codeContent = codeBlockMatch[2].trim();
              parts.push({ type: "code", content: codeContent, language });
            }
            
            lastIndex = matchIndex + matchText.length;
          }
          
          // Add remaining text after last code block
          if (lastIndex < text.length) {
            const textAfter = text.slice(lastIndex).trim();
            if (textAfter) {
              parts.push({ type: "text", content: textAfter });
            }
          }
          
          // Insert each part separately with proper spacing
          let chain = currentEditor.chain().focus();
          
          parts.forEach((part, index) => {
            if (part.type === "code") {
              // Insert code block
              chain = chain.insertContent({
                type: "codeBlock",
                attrs: part.language ? { language: part.language } : {},
                content: part.content ? [{ type: "text", text: part.content }] : [],
              });
              
              // Add paragraph after code block for spacing (except for last item)
              if (index < parts.length - 1) {
                chain = chain.insertContent({ type: "paragraph" });
              }
            } else {
              // Parse markdown content and insert as HTML
              // TipTap will automatically parse HTML content
              try {
                const htmlContent = renderMarkdownSync(part.content);
                // Insert HTML content - TipTap will automatically parse HTML strings
                chain = chain.insertContent(htmlContent);
              } catch (error) {
                // Fallback: insert as plain text if markdown parsing fails
                console.error("Markdown parsing error:", error);
                const paragraphs = part.content.split(/\n\n+/).filter(p => p.trim());
                paragraphs.forEach((para, paraIndex) => {
                  if (paraIndex > 0) {
                    chain = chain.insertContent({ type: "paragraph" });
                  }
                  chain = chain.insertContent(para.trim());
                });
              }
            }
          });
          
          chain.run();
          
          return true;
        }
        
        // Check if content looks like markdown (has markdown syntax)
        const markdownPatterns = [
          /^#{1,6}\s/m, // Headers
          /\*\*.*?\*\*/, // Bold
          /\*.*?\*/, // Italic
          /^\s*[-*+]\s/m, // Bullet lists
          /^\s*\d+\.\s/m, // Numbered lists
          /```[\s\S]*?```/, // Code blocks
          /\[.*?\]\(.*?\)/, // Links
          /!\[.*?\]\(.*?\)/, // Images
        ];
        
        const hasMarkdownSyntax = markdownPatterns.some(pattern => pattern.test(text));
        
        if (hasMarkdownSyntax) {
          // Parse markdown and insert
          event.preventDefault();
          
          const currentEditor = editorRef.current;
          if (!currentEditor) return false;
          
          try {
            // Convert markdown to HTML
            const htmlContent = renderMarkdownSync(text);
            // Insert HTML - TipTap will automatically parse HTML strings
            // We need to use setContent or insertContent with HTML string
            currentEditor.chain().focus().insertContent(htmlContent).run();
            return true;
          } catch (error) {
            console.error("Markdown parsing error:", error);
            // Fallback to default behavior
            return false;
          }
        }
        
        // No markdown detected - use default behavior
        return false;
      },
    },
  });

  // Update ref when editor changes
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
    onPublish(json, markdown, title || "Untitled", hashtags, bannerUrl || undefined);
  };

  const addHashtag = (tag?: string) => {
    const tagToAdd = (tag || hashtagInput).trim().toLowerCase().replace(/^#/, "");
    if (tagToAdd && tagToAdd.length > 0 && !hashtags.includes(tagToAdd)) {
      setHashtags([...hashtags, tagToAdd]);
      setHashtagInput("");
    }
  };

  const removeHashtag = (tag: string) => {
    setHashtags(hashtags.filter((t) => t !== tag));
  };

  const handleHashtagInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setHashtagInput(value);

    // Auto-create hashtag on comma or space
    if (value.includes(",") || value.includes(" ")) {
      const parts = value.split(/[,\s]+/);
      const newTag = parts[0].trim().replace(/^#/, "");
      if (newTag && newTag.length > 0) {
        addHashtag(newTag);
        // Keep remaining text if there's more after comma/space
        const remaining = parts.slice(1).join(" ").trim();
        if (remaining) {
          setHashtagInput(remaining);
        }
      }
    }
  };

  const handleHashtagKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addHashtag();
    }
  };

  if (!editor) {
    return null;
  }

  return (
    <div className="">
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Title Input */}
        <div className="mb-8">
          <input
            type="text"
            placeholder="Post title..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-5xl font-bold w-full border-none outline-none bg-transparent text-light-text dark:text-dark-text placeholder:text-light-muted dark:placeholder:text-dark-muted mb-6"
          />
          
          <div className="flex items-center gap-2">
            <div className="flex flex-wrap items-center gap-2">
              {hashtags.map((tag) => (
                <span
                  key={tag}
                  className="px-3 py-1.5 bg-light-pine/15 dark:bg-dark-pine/25 text-light-pine dark:text-dark-foam rounded-full text-sm flex items-center gap-2 border border-light-pine/30 dark:border-dark-pine/40 font-medium transition-all hover:bg-light-pine/20 dark:hover:bg-dark-pine/30"
                >
                  <span className="text-light-pine dark:text-dark-foam">#</span>
                  {tag}
                  <button
                    onClick={() => removeHashtag(tag)}
                    className="hover:text-light-love dark:hover:text-dark-love transition-colors text-base leading-none ml-1"
                    aria-label={`Remove ${tag}`}
                  >
                    ×
                  </button>
                </span>
              ))}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Add hashtags (comma or space to add)..."
                  value={hashtagInput}
                  onChange={handleHashtagInputChange}
                  onKeyPress={handleHashtagKeyPress}
                  className={`px-3 py-1.5 border rounded-lg text-sm bg-light-surface dark:bg-dark-surface opacity-100 text-light-text dark:text-dark-text placeholder:text-light-muted dark:placeholder:text-dark-muted focus:outline-none focus:ring-2 transition-all ${
                    hashtagInput.trim()
                      ? "border-light-pine dark:border-dark-pine focus:ring-light-pine dark:focus:ring-dark-pine bg-light-pine/5 dark:bg-dark-pine/10"
                      : "border-light-highlight-med dark:border-dark-highlight-med focus:ring-light-pine dark:focus:ring-dark-pine focus:border-light-pine dark:focus:border-dark-pine"
                  }`}
                />
                {hashtagInput.trim() && (
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-light-pine dark:text-dark-foam font-medium">
                    Press Enter or comma
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <label
                htmlFor="banner-upload"
                className="cursor-pointer text-light-pine dark:text-dark-foam font-medium"
              >
                Upload Banner
              </label>
              <input
                id="banner-upload"
                type="file"
                accept="image/*"
                onChange={handleBannerUpload}
                className="hidden"
              />
              {bannerUploading && (
                <span className="text-sm text-light-muted dark:text-dark-muted">Uploading...</span>
              )}
              {(bannerImage || bannerUrl) && (
                <button
                  type="button"
                  onClick={() => {
                    if (bannerImage && bannerImage.startsWith("blob:")) {
                      URL.revokeObjectURL(bannerImage);
                    }
                    setBannerImage("");
                    setBannerUrl("");
                  }}
                  className="text-sm text-light-love dark:text-dark-love"
                >
                  Remove
                </button>
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
                className="object-cover rounded-lg border border-light-highlight-med dark:border-dark-highlight-med"
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

        {/* Editor Container */}
        <div className="bg-light-surface dark:bg-dark-surface opacity-100 rounded-xl border border-light-highlight-med dark:border-dark-highlight-med shadow-lg overflow-hidden mb-6">
          {/* Toolbar */}
          <div className="border-b border-light-highlight-med dark:border-dark-highlight-med px-4 py-3 flex items-center gap-1 flex-wrap bg-light-overlay dark:bg-dark-overlay opacity-100">
            <button
              onClick={() => editor.chain().focus().toggleBold().run()}
              className={`p-2 rounded-md transition-colors ${
                editor.isActive("bold")
                  ? "bg-light-pine/20 dark:bg-dark-pine/30 text-light-pine dark:text-dark-foam"
                  : "text-light-text dark:text-dark-text hover:bg-light-overlay dark:hover:bg-dark-overlay"
              }`}
              title="Bold"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 12h9a4 4 0 014 4 4 4 0 01-4 4H6z" />
              </svg>
            </button>
            <button
              onClick={() => editor.chain().focus().toggleItalic().run()}
              className={`p-2 rounded-md transition-colors ${
                editor.isActive("italic")
                  ? "bg-light-pine/20 dark:bg-dark-pine/30 text-light-pine dark:text-dark-foam"
                  : "text-light-text dark:text-dark-text hover:bg-light-overlay dark:hover:bg-dark-overlay"
              }`}
              title="Italic"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
            </button>
            <div className="w-px h-6 bg-light-highlight-med dark:bg-dark-highlight-med mx-1" />
            <button
              onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
              className={`p-2 rounded-md transition-colors text-sm font-semibold ${
                editor.isActive("heading", { level: 1 })
                  ? "bg-light-pine/20 dark:bg-dark-pine/30 text-light-pine dark:text-dark-foam"
                  : "text-light-text dark:text-dark-text hover:bg-light-overlay dark:hover:bg-dark-overlay"
              }`}
              title="Heading 1"
            >
              H1
            </button>
            <button
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              className={`p-2 rounded-md transition-colors text-sm font-semibold ${
                editor.isActive("heading", { level: 2 })
                  ? "bg-light-pine/20 dark:bg-dark-pine/30 text-light-pine dark:text-dark-foam"
                  : "text-light-text dark:text-dark-text hover:bg-light-overlay dark:hover:bg-dark-overlay"
              }`}
              title="Heading 2"
            >
              H2
            </button>
            <button
              onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
              className={`p-2 rounded-md transition-colors text-sm font-semibold ${
                editor.isActive("heading", { level: 3 })
                  ? "bg-light-pine/20 dark:bg-dark-pine/30 text-light-pine dark:text-dark-foam"
                  : "text-light-text dark:text-dark-text hover:bg-light-overlay dark:hover:bg-dark-overlay"
              }`}
              title="Heading 3"
            >
              H3
            </button>
            <div className="w-px h-6 bg-light-highlight-med dark:bg-dark-highlight-med mx-1" />
            <button
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              className={`p-2 rounded-md transition-colors ${
                editor.isActive("bulletList")
                  ? "bg-light-pine/20 dark:bg-dark-pine/30 text-light-pine dark:text-dark-foam"
                  : "text-light-text dark:text-dark-text hover:bg-light-overlay dark:hover:bg-dark-overlay"
              }`}
              title="Bullet List"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 6h13M8 12h13m-13 6h13M3 6h.01M3 12h.01M3 18h.01" />
              </svg>
            </button>
            <button
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              className={`p-2 rounded-md transition-colors ${
                editor.isActive("orderedList")
                  ? "bg-light-pine/20 dark:bg-dark-pine/30 text-light-pine dark:text-dark-foam"
                  : "text-light-text dark:text-dark-text hover:bg-light-overlay dark:hover:bg-dark-overlay"
              }`}
              title="Numbered List"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
              </svg>
            </button>
            <div className="w-px h-6 bg-light-highlight-med dark:bg-dark-highlight-med mx-1" />
            <button
              onClick={() => editor.chain().focus().toggleCodeBlock().run()}
              className={`p-2 rounded-md transition-colors ${
                editor.isActive("codeBlock")
                  ? "bg-light-pine/20 dark:bg-dark-pine/30 text-light-pine dark:text-dark-foam"
                  : "text-light-text dark:text-dark-text hover:bg-light-overlay dark:hover:bg-dark-overlay"
              }`}
              title="Code Block"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
            </button>
            <button
              onClick={() => {
                const url = window.prompt("Enter image URL:");
                if (url) {
                  editor.chain().focus().setImage({ src: url }).run();
                }
              }}
              className="p-2 rounded-md transition-colors text-light-text dark:text-dark-text hover:bg-light-overlay dark:hover:bg-dark-overlay"
              title="Insert Image"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </button>
            <button
              onClick={() => {
                const url = window.prompt("Enter link URL:");
                if (url) {
                  editor.chain().focus().setLink({ href: url }).run();
                }
              }}
              className="p-2 rounded-md transition-colors text-light-text dark:text-dark-text hover:bg-light-overlay dark:hover:bg-dark-overlay"
              title="Insert Link"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            </button>
          </div>
          
          {/* Editor Content */}
          <div className="bg-light-surface dark:bg-dark-surface opacity-100 relative">
            <EditorContent editor={editor} />
            {imageUploading && (
              <div className="absolute top-4 right-4 bg-light-pine/90 dark:bg-dark-pine/90 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 z-10">
                <LoadingSpinner size="sm" />
                <span className="text-sm font-medium">Uploading image...</span>
              </div>
            )}
          </div>
        </div>

          {/* Action Buttons */}
        <div className="flex items-center justify-between gap-4">
          <div className="text-sm text-light-muted dark:text-dark-muted">
            {editor.state.doc.textContent.length} characters
          </div>
          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save Draft"}
            </Button>
            <Button
              variant="primary"
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

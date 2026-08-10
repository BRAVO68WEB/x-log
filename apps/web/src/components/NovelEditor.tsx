"use client";

import { useState, useCallback } from "react";
import {
  EditorContent,
  EditorRoot,
  type EditorInstance,
  type JSONContent,
  handleCommandNavigation,
  handleImageDrop,
  handleImagePaste,
  createImageUpload,
  EditorCommand,
  EditorCommandEmpty,
  EditorCommandItem,
  EditorCommandList,
  Command,
  StarterKit,
  TiptapLink,
  CharacterCount,
  CodeBlockLowlight,
  Placeholder,
  CustomKeymap,
  TiptapImage,
  TaskList,
  TaskItem,
  UploadImagesPlugin,
  renderItems,
  createSuggestionItems,
} from "novel";
import { Markdown } from "tiptap-markdown";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import { createLowlight, common } from "lowlight";
import { useMutation } from "react-query";
import NextImage from "next/image";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";
import {
  CheckSquare,
  Code,
  Heading1,
  Heading2,
  Heading3,
  ImageIcon,
  List,
  ListOrdered,
  Text,
  TextQuote,
  Twitter,
  Youtube,
  Table as TableIcon,
} from "lucide-react";
import { cx } from "class-variance-authority";
import dynamic from "next/dynamic";
import { withCsrf } from "@/lib/csrf";

const AIToolbar = dynamic(() => import("./AIToolbar"), { ssr: false });

const lowlight = createLowlight(common);

const suggestionItems = createSuggestionItems([
  {
    title: "Text",
    description: "Just start typing with plain text.",
    searchTerms: ["p", "paragraph"],
    icon: <Text size={18} />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleNode("paragraph", "paragraph").run();
    },
  },
  {
    title: "To-do List",
    description: "Track tasks with a to-do list.",
    searchTerms: ["todo", "task", "list", "check", "checkbox"],
    icon: <CheckSquare size={18} />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleTaskList().run();
    },
  },
  {
    title: "Heading 1",
    description: "Big section heading.",
    searchTerms: ["title", "big", "large"],
    icon: <Heading1 size={18} />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode("heading", { level: 1 }).run();
    },
  },
  {
    title: "Heading 2",
    description: "Medium section heading.",
    searchTerms: ["subtitle", "medium"],
    icon: <Heading2 size={18} />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode("heading", { level: 2 }).run();
    },
  },
  {
    title: "Heading 3",
    description: "Small section heading.",
    searchTerms: ["subtitle", "small"],
    icon: <Heading3 size={18} />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode("heading", { level: 3 }).run();
    },
  },
  {
    title: "Bullet List",
    description: "Create a simple bullet list.",
    searchTerms: ["unordered", "point"],
    icon: <List size={18} />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run();
    },
  },
  {
    title: "Numbered List",
    description: "Create a list with numbering.",
    searchTerms: ["ordered"],
    icon: <ListOrdered size={18} />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleOrderedList().run();
    },
  },
  {
    title: "Quote",
    description: "Capture a quote.",
    searchTerms: ["blockquote"],
    icon: <TextQuote size={18} />,
    command: ({ editor, range }) =>
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .toggleNode("paragraph", "paragraph")
        .toggleBlockquote()
        .run(),
  },
  {
    title: "Code",
    description: "Capture a code snippet.",
    searchTerms: ["codeblock"],
    icon: <Code size={18} />,
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleCodeBlock().run(),
  },
  {
    title: "Image",
    description: "Upload an image from your computer.",
    searchTerms: ["photo", "picture", "media"],
    icon: <ImageIcon size={18} />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).run();
      // upload image
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.onchange = async () => {
        if (input.files?.length) {
          const file = input.files[0];
          const pos = editor.view.state.selection.from;
          uploadFn(file, editor.view, pos);
        }
      };
      input.click();
    },
  },
  {
    title: "Youtube",
    description: "Embed a Youtube video.",
    searchTerms: ["video", "youtube", "embed"],
    icon: <Youtube size={18} />,
    command: ({ editor, range }) => {
      const videoLink = prompt("Please enter Youtube Video Link");
      //From https://regexr.com/3dj5t
      const ytregex = new RegExp(
        /^((?:https?:)?\/\/)?((?:www|m)\.)?((?:youtube\.com|youtu.be))(\/(?:[\w\-]+\?v=|embed\/|v\/)?)([\w\-]+)(\S+)?$/
      );

      if (ytregex.test(videoLink as string)) {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .setYoutubeVideo({
            src: videoLink as string,
          })
          .run();
      } else {
        if (videoLink !== null) {
          alert("Please enter a correct Youtube Video Link");
        }
      }
    },
  },
  {
    title: "Twitter",
    description: "Embed a Tweet.",
    searchTerms: ["twitter", "embed"],
    icon: <Twitter size={18} />,
    command: ({ editor, range }) => {
      const tweetLink = prompt("Please enter Twitter Link");
      const tweetRegex = new RegExp(
        /^https?:\/\/(www\.)?x\.com\/([a-zA-Z0-9_]{1,15})(\/status\/(\d+))?(\/\S*)?$/
      );

      if (tweetRegex.test(tweetLink as string)) {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .setTweet({
            src: tweetLink as string,
          })
          .run();
      } else {
        if (tweetLink !== null) {
          alert("Please enter a correct Twitter Link");
        }
      }
    },
  },
  {
    title: "Table",
    description: "Insert a table.",
    searchTerms: ["table", "grid", "spreadsheet"],
    icon: <TableIcon size={18} />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
    },
  },
]);

const slashCommand = Command.configure({
  suggestion: {
    items: () => suggestionItems,
    render: renderItems,
  },
});

// interface SuggestionItem {
//   title: string;
//   description: string;
//   searchTerms: string[];
//   icon: React.ReactNode;
//   command: ({
//     editor,
//     range,
//   }: {
//     editor: EditorInstance;
//     range: { from: number; to: number };
//   }) => void;
// }

const uploadFn = createImageUpload({
  validateFn: (file: File) => {
    if (!file.type.includes("image/")) {
      toast.error("File type not supported.");
      return false;
    }
    if (file.size / 1024 / 1024 > 20) {
      toast.error("File size too big (max 20MB).");
      return false;
    }
    return true;
  },
  onUpload: async (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("asset_type", "post_attachment");
    const res = await fetch(`/api/media/upload`, withCsrf({
      method: "POST",
      credentials: "include",
      body: fd,
    }));
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Upload failed" }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    const { url } = (await res.json()) as { url: string };
    return url;
  },
});

function resolveNovelInitialContent(content?: JSONContent | string): JSONContent | undefined {
  if (content == null || content === "") return undefined;
  return typeof content === "string" ? undefined : content;
}

interface EditorProps {
  initialContent?: JSONContent | string;
  initialTitle?: string;
  initialSummary?: string;
  initialHashtags?: string[];
  initialBannerUrl?: string;
  onSave?: (content: JSONContent | string, markdown: string, bannerUrl?: string) => void;
  onPublish?: (
    content: JSONContent | string,
    markdown: string,
    title: string,
    hashtags: string[],
    bannerUrl?: string,
    summary?: string
  ) => void;
  saving?: boolean;
  publishLabel?: string;
  showAIToolbar?: boolean;
  sidebar?: React.ReactNode;
}

const tiptapImage = TiptapImage.extend({
  addProseMirrorPlugins() {
    return [
      UploadImagesPlugin({
        imageClass: cx("opacity-40 rounded-lg border border-stone-200"),
      }),
    ];
  },
}).configure({
  allowBase64: true,
  HTMLAttributes: {
    class: cx("rounded-lg border border-muted"),
  },
});

const extensions = [
  StarterKit.configure({
    codeBlock: false,
    dropcursor: {
      color: "#DBEAFE",
      width: 4,
    },
    gapcursor: false,
  }),
  Placeholder.configure({
    placeholder: "Start writing your post...",
  }),
  TiptapLink.configure({
    openOnClick: false,
  }),
  tiptapImage,
  CodeBlockLowlight.configure({
    lowlight,
  }),
  CharacterCount,
  Markdown.configure({
    html: false,
    transformCopiedText: true,
    transformPastedText: true,
    tightLists: true,
    tightListClass: "tight",
    bulletListMarker: "-",
    linkify: false,
    breaks: false,
  }),
  CustomKeymap,
  TaskList,
  TaskItem.configure({
    nested: true,
  }),
  Table.configure({ resizable: true }),
  TableRow,
  TableCell,
  TableHeader,
  slashCommand,
];

export default function Editor({
  initialContent,
  initialTitle,
  initialSummary,
  initialHashtags,
  initialBannerUrl,
  onSave,
  onPublish,
  saving = false,
  publishLabel = "Publish",
  showAIToolbar = true,
  sidebar,
}: EditorProps) {
  const [title, setTitle] = useState(initialTitle || "");
  const [summary, setSummary] = useState(initialSummary || "");
  const [hashtags, setHashtags] = useState<string[]>(initialHashtags || []);
  const [hashtagInput, setHashtagInput] = useState("");

  const [bannerImage, setBannerImage] = useState<string>(initialBannerUrl || "");
  const [bannerUrl, setBannerUrl] = useState<string>(initialBannerUrl || "");
  const [bannerUploading, setBannerUploading] = useState(false);

  const [editorInstance, setEditorInstance] = useState<EditorInstance | null>(null);

  const uploadBannerMutation = useMutation(async (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("asset_type", "banner");
    const res = await fetch(`/api/media/upload`, withCsrf({
      method: "POST",
      credentials: "include",
      body: fd,
    }));
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

  const handleSave = useCallback(() => {
    if (!editorInstance || !onSave) return;
    const json = editorInstance.getJSON();
    const markdown = editorInstance.storage.markdown.getMarkdown();
    onSave(json, markdown, bannerUrl || undefined);
  }, [editorInstance, onSave, bannerUrl]);

  const handlePublish = useCallback(() => {
    if (!editorInstance || !onPublish) return;
    const json = editorInstance.getJSON();
    const markdown = editorInstance.storage.markdown.getMarkdown();
    onPublish(
      json,
      markdown,
      title || "Untitled",
      hashtags,
      bannerUrl || undefined,
      summary || undefined
    );
  }, [editorInstance, onPublish, title, hashtags, bannerUrl, summary]);

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

  const handleHashtagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addHashtag();
    }
  };

  const editorContent = resolveNovelInitialContent(initialContent);

  return (
    <div>
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-8">
        <div className="mb-6 sm:mb-8">
          <input
            type="text"
            placeholder="Post title..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-3xl sm:text-4xl md:text-5xl font-normal tracking-[-0.04em] leading-tight w-full border-none outline-none bg-transparent font-heading placeholder:text-muted-foreground mb-3 sm:mb-4"
          />
          <textarea
            placeholder="Write a brief summary or excerpt (optional)..."
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={2}
            className="w-full border-none outline-none bg-transparent text-muted-foreground placeholder:text-muted-foreground mb-4 sm:mb-6 resize-none text-sm leading-relaxed"
          />

          <div className="flex flex-col gap-3 sm:gap-2">
            <div className="flex flex-wrap items-center gap-2">
              {hashtags.map((tag) => (
                <Badge key={tag} variant="secondary" className="gap-1 pl-2.5">
                  <span className="text-primary">#</span>
                  {tag}
                  <button
                    onClick={() => removeHashtag(tag)}
                    className="hover:text-destructive transition-colors ml-1 min-h-6 min-w-6"
                    aria-label={`Remove ${tag}`}
                  >
                    x
                  </button>
                </Badge>
              ))}
              <div className="relative min-w-0 flex-1 sm:flex-initial">
                <input
                  type="text"
                  placeholder="Add hashtags..."
                  value={hashtagInput}
                  onChange={handleHashtagInputChange}
                  onKeyDown={handleHashtagKeyDown}
                  className="w-full sm:w-auto px-3 py-1.5 border border-input rounded-md text-sm bg-card placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/35"
                />
              </div>
            </div>
            <div className="flex flex-col xs:flex-row sm:flex-row flex-wrap items-stretch sm:items-center gap-2">
              <input
                type="url"
                placeholder="Banner image URL..."
                value={bannerUrl}
                onChange={(e) => {
                  const value = e.target.value;
                  setBannerUrl(value);
                  if (value) {
                    setBannerImage(value);
                  } else if (bannerImage && !bannerImage.startsWith("blob:")) {
                    setBannerImage("");
                  }
                }}
                className="w-full sm:w-64 min-w-0 px-3 py-1.5 border border-input rounded-md text-sm bg-card placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/35"
              />
              <div className="flex flex-wrap items-center gap-2">
                <label
                  htmlFor="banner-upload"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "cursor-pointer min-h-9"
                  )}
                >
                  Upload Banner
                </label>
                <input
                  id="banner-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleBannerUpload}
                  className="sr-only"
                />
                {bannerUploading && (
                  <span className="text-sm text-muted-foreground">Uploading...</span>
                )}
                {(bannerImage || bannerUrl) && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => {
                      if (bannerImage && bannerImage.startsWith("blob:")) {
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
          </div>
          {(bannerImage || bannerUrl) && (
            <div className="mt-4 relative w-full h-36 sm:h-48">
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

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
          <Card className="overflow-hidden">
          {showAIToolbar && editorInstance && (
            <div className="px-4 py-3 border-b border-border bg-accent/30">
              <AIToolbar
                selectedText={editorInstance.state.doc.textBetween(
                  editorInstance.state.selection.from,
                  editorInstance.state.selection.to,
                  " "
                )}
                fullContent={editorInstance.storage.markdown.getMarkdown()}
                onReplace={(newText) => {
                  const { from, to } = editorInstance.state.selection;
                  if (from !== to) {
                    editorInstance
                      .chain()
                      .focus()
                      .deleteRange({ from, to })
                      .insertContent(newText)
                      .run();
                  }
                }}
                onAppend={(text) => {
                  editorInstance
                    .chain()
                    .focus()
                    .insertContent("\n\n" + text)
                    .run();
                }}
                onTitleGenerated={(t) => setTitle(t)}
                onMetaGenerated={(meta) => {
                  toast.success(
                    `Title: ${meta.title}\nDescription: ${meta.description}\nTags: ${meta.tags.join(", ")}`,
                    { duration: 6000 }
                  );
                }}
              />
            </div>
          )}
          <EditorRoot>
            <EditorContent
              initialContent={editorContent}
              extensions={extensions}
              editorProps={{
                handleDOMEvents: {
                  keydown: (_view, event) => handleCommandNavigation(event),
                },
                handlePaste: (view, event) => handleImagePaste(view, event, uploadFn),
                handleDrop: (view, event, _slice, moved) =>
                  handleImageDrop(view, event, moved, uploadFn),
                attributes: {
                  class: "prose prose-lg max-w-none focus:outline-none min-h-[600px] p-6",
                },
              }}
              onUpdate={({ editor }) => {
                setEditorInstance(editor);
              }}
              onCreate={({ editor }) => {
                setEditorInstance(editor);
              }}
            >
              <EditorCommand className="z-50 h-auto max-h-[330px] w-full overflow-y-auto rounded-md border border-muted bg-background px-1 py-2 shadow-md transition-all">
                <EditorCommandEmpty className="px-2 text-muted-foreground">
                  No results
                </EditorCommandEmpty>
                <EditorCommandList>
                  {suggestionItems.map((item) => (
                    <EditorCommandItem
                      value={item.title}
                      onCommand={(val) => item.command!(val)}
                      className="flex w-full cursor-pointer items-center space-x-2 rounded-md px-2 py-1 text-left text-sm hover:bg-accent aria-selected:bg-accent"
                      key={item.title}
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-md border border-muted bg-background">
                        {item.icon}
                      </div>
                      <div>
                        <p className="font-medium">{item.title}</p>
                        <p className="text-xs text-muted-foreground">{item.description}</p>
                      </div>
                    </EditorCommandItem>
                  ))}
                </EditorCommandList>
              </EditorCommand>

              <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 px-3 sm:px-4 py-3 border-t border-border bg-accent/50">
                <div className="text-xs sm:text-sm text-muted-foreground text-center sm:text-left">
                  {editorInstance?.storage.characterCount.characters() || 0} characters
                </div>
                <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto">
                  <Button
                    variant="outline"
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full sm:w-auto min-h-11 sm:min-h-9"
                  >
                    {saving ? "Saving..." : "Save Draft"}
                  </Button>
                  <Button
                    onClick={handlePublish}
                    disabled={saving || !title.trim()}
                    className="w-full sm:w-auto min-h-11 sm:min-h-9"
                  >
                    {saving ? "Saving..." : publishLabel}
                  </Button>
                </div>
              </div>
            </EditorContent>
          </EditorRoot>
        </Card>

        {sidebar && (
          <aside className="lg:sticky lg:top-24 self-start order-last lg:order-none w-full min-w-0">
            {sidebar}
          </aside>
        )}
        </div>
      </div>
    </div>
  );
}

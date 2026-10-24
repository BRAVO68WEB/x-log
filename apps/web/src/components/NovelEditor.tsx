"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { Extension, type Editor as TiptapEditor, type JSONContent, type Range } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Suggestion from "@tiptap/suggestion";
import { CharacterCount, Placeholder } from "@tiptap/extensions";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import TiptapImage from "@tiptap/extension-image";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import Youtube from "@tiptap/extension-youtube";
import { Markdown } from "tiptap-markdown";
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
  Share2,
  Video,
  Table as TableIcon,
} from "lucide-react";
import dynamic from "next/dynamic";
import { withCsrf } from "@/lib/csrf";

const AIToolbar = dynamic(() => import("./AIToolbar"), { ssr: false });

const lowlight = createLowlight(common);

type SlashItem = {
  title: string;
  description: string;
  searchTerms: string[];
  icon: React.ReactNode;
  command: (props: { editor: TiptapEditor; range: Range }) => void;
};

type SlashMenu = {
  items: SlashItem[];
  selected: number;
  clientRect: (() => DOMRect | null) | null;
  command: (item: SlashItem) => void;
};

const suggestionItems: SlashItem[] = [
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
        const file = input.files?.[0];
        if (!file) return;
        try {
          const url = await uploadEditorImage(file);
          editor.chain().focus().setImage({ src: url }).run();
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Upload failed");
        }
      };
      input.click();
    },
  },
  {
    title: "Youtube",
    description: "Embed a Youtube video.",
    searchTerms: ["video", "youtube", "embed"],
    icon: <Video size={18} />,
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
    icon: <Share2 size={18} />,
    command: ({ editor, range }) => {
      const tweetLink = prompt("Please enter Twitter Link");
      const tweetRegex = new RegExp(
        /^https?:\/\/(www\.)?x\.com\/([a-zA-Z0-9_]{1,15})(\/status\/(\d+))?(\/\S*)?$/
      );

      if (tweetLink && tweetRegex.test(tweetLink)) {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .insertContent(`<a href="${tweetLink}">${tweetLink}</a>`)
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
];

function filterSlashItems(query: string): SlashItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return suggestionItems;
  return suggestionItems.filter((item) => {
    return (
      item.title.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q) ||
      item.searchTerms.some((term) => term.toLowerCase().includes(q))
    );
  });
}

async function uploadEditorImage(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("File type not supported.");
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new Error("File size too big (max 10MB).");
  }
  const fd = new FormData();
  fd.append("file", file);
  fd.append("asset_type", "post_attachment");
  const res = await fetch(
    `/api/media/upload`,
    withCsrf({
      method: "POST",
      credentials: "include",
      body: fd,
    })
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Upload failed" }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  const { url } = (await res.json()) as { url: string };
  return url;
}

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

function editorMarkdown(editor: TiptapEditor): string {
  const storage = editor.storage as TiptapEditor["storage"] & {
    markdown?: { getMarkdown: () => string };
  };
  return storage.markdown?.getMarkdown() ?? "";
}

function editorExtensions(setSlashMenu: (menu: SlashMenu | null) => void, slashRef: { current: SlashMenu | null }) {
  const slashCommand = Extension.create({
    name: "slashCommand",
    addProseMirrorPlugins() {
      return [
        Suggestion<SlashItem, SlashItem>({
          editor: this.editor,
          char: "/",
          items: ({ query }) => filterSlashItems(query),
          command: ({ editor, range, props }) => {
            props.command({ editor, range });
          },
          render: () => {
            let selected = 0;
            const publish = (
              props: {
                items: SlashItem[];
                command: (item: SlashItem) => void;
                clientRect?: (() => DOMRect | null) | null;
              } | null
            ) => {
              if (!props) {
                slashRef.current = null;
                setSlashMenu(null);
                return;
              }
              const menu: SlashMenu = {
                items: props.items,
                selected: props.items.length === 0 ? 0 : Math.min(selected, props.items.length - 1),
                clientRect: props.clientRect ?? null,
                command: (item) => props.command(item),
              };
              slashRef.current = menu;
              setSlashMenu(menu);
            };
            return {
              onStart: (props) => {
                selected = 0;
                publish(props);
              },
              onUpdate: (props) => publish(props),
              onExit: () => publish(null),
              onKeyDown: ({ event }) => {
                const menu = slashRef.current;
                if (!menu || menu.items.length === 0) return false;
                if (event.key === "ArrowDown") {
                  selected = (menu.selected + 1) % menu.items.length;
                  publish(menu);
                  return true;
                }
                if (event.key === "ArrowUp") {
                  selected = (menu.selected + menu.items.length - 1) % menu.items.length;
                  publish(menu);
                  return true;
                }
                if (event.key === "Enter") {
                  const item = menu.items[menu.selected];
                  if (item) menu.command(item);
                  return true;
                }
                return false;
              },
            };
          },
        }),
      ];
    },
  });

  return [
    StarterKit.configure({
      codeBlock: false,
      link: { openOnClick: false },
      dropcursor: {
        color: "#DBEAFE",
        width: 4,
      },
      gapcursor: false,
    }),
    Placeholder.configure({
      placeholder: "Start writing your post...",
    }),
    TiptapImage.configure({
      allowBase64: true,
      HTMLAttributes: {
        class: "rounded-lg border border-muted",
      },
    }),
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
    TaskList,
    TaskItem.configure({
      nested: true,
    }),
    Table.configure({ resizable: true }),
    TableRow,
    TableCell,
    TableHeader,
    Youtube.configure({
      nocookie: true,
    }),
    slashCommand,
  ];
}

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
  const [slashMenu, setSlashMenu] = useState<SlashMenu | null>(null);
  const [extensions] = useState(() => {
    const slashRef = { current: null as SlashMenu | null };
    return editorExtensions(setSlashMenu, slashRef);
  });

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

  const editorRef = useRef<TiptapEditor | null>(null);
  const editorContent = resolveNovelInitialContent(initialContent);
  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    extensions,
    content: editorContent,
    editorProps: {
      attributes: {
        class: "prose prose-lg max-w-none focus:outline-none min-h-[600px] p-6",
      },
      handlePaste: (_view, event) => {
        const file = Array.from(event.clipboardData?.files ?? []).find((item) =>
          item.type.startsWith("image/")
        );
        if (!file) return false;
        event.preventDefault();
        void uploadEditorImage(file)
          .then((url) => editorRef.current?.chain().focus().setImage({ src: url }).run())
          .catch((err) => toast.error(err instanceof Error ? err.message : "Upload failed"));
        return true;
      },
      handleDrop: (view, event, _slice, moved) => {
        if (moved) return false;
        const file = Array.from(event.dataTransfer?.files ?? []).find((item) =>
          item.type.startsWith("image/")
        );
        if (!file) return false;
        event.preventDefault();
        const coords = view.posAtCoords({ left: event.clientX, top: event.clientY });
        void uploadEditorImage(file)
          .then((url) => {
            const current = editorRef.current;
            if (!current) return;
            const chain = current.chain().focus();
            if (coords) chain.setTextSelection(coords.pos);
            chain.setImage({ src: url }).run();
          })
          .catch((err) => toast.error(err instanceof Error ? err.message : "Upload failed"));
        return true;
      },
    },
  });
  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  const handleSave = useCallback(() => {
    if (!editor || !onSave) return;
    const json = editor.getJSON();
    const markdown = editorMarkdown(editor);
    onSave(json, markdown, bannerUrl || undefined);
  }, [editor, onSave, bannerUrl]);

  const handlePublish = useCallback(() => {
    if (!editor || !onPublish) return;
    const json = editor.getJSON();
    const markdown = editorMarkdown(editor);
    onPublish(
      json,
      markdown,
      title || "Untitled",
      hashtags,
      bannerUrl || undefined,
      summary || undefined
    );
  }, [editor, onPublish, title, hashtags, bannerUrl, summary]);

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

  const slashRect = slashMenu?.clientRect?.() ?? null;

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
          {showAIToolbar && editor && (
            <div className="px-4 py-3 border-b border-border bg-accent/30">
              <AIToolbar
                selectedText={editor.state.doc.textBetween(
                  editor.state.selection.from,
                  editor.state.selection.to,
                  " "
                )}
                fullContent={editorMarkdown(editor)}
                onReplace={(newText) => {
                  const { from, to } = editor.state.selection;
                  if (from !== to) {
                    editor.chain().focus().deleteRange({ from, to }).insertContent(newText).run();
                  }
                }}
                onAppend={(text) => {
                  editor.chain().focus().insertContent("\n\n" + text).run();
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
          <EditorContent editor={editor} />
          {slashMenu && slashRect && (
            <div
              className="z-50 h-auto max-h-[330px] w-72 overflow-y-auto rounded-md border border-muted bg-background px-1 py-2 shadow-md"
              style={{ position: "fixed", top: slashRect.bottom + 4, left: slashRect.left }}
            >
              {slashMenu.items.length === 0 ? (
                <div className="px-2 text-muted-foreground">No results</div>
              ) : (
                slashMenu.items.map((item, index) => (
                  <button
                    type="button"
                    key={item.title}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      slashMenu.command(item);
                    }}
                    className={cn(
                      "flex w-full cursor-pointer items-center space-x-2 rounded-md px-2 py-1 text-left text-sm hover:bg-accent",
                      index === slashMenu.selected && "bg-accent"
                    )}
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-md border border-muted bg-background">
                      {item.icon}
                    </div>
                    <div>
                      <p className="font-medium">{item.title}</p>
                      <p className="text-xs text-muted-foreground">{item.description}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
              <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 px-3 sm:px-4 py-3 border-t border-border bg-accent/50">
                <div className="text-xs sm:text-sm text-muted-foreground text-center sm:text-left">
                  {editor?.storage.characterCount.characters() || 0} characters
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

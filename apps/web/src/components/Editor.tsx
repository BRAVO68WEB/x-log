"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { createLowlight } from "lowlight";
import TurndownService from "turndown";
import { useState } from "react";

const lowlight = createLowlight();

const turndownService = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
});

interface EditorProps {
  initialContent?: any;
  onSave?: (content: any, markdown: string) => void;
  onPublish?: (content: any, markdown: string, title: string, hashtags: string[]) => void;
  saving?: boolean;
}

export function Editor({ initialContent, onSave, onPublish, saving = false }: EditorProps) {
  const [title, setTitle] = useState("");
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [hashtagInput, setHashtagInput] = useState("");

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
      }),
      CodeBlockLowlight.configure({
        lowlight,
      }),
      Image.configure({
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
          "prose prose-lg max-w-none focus:outline-none min-h-[500px] p-4",
      },
    },
  });

  const handleSave = () => {
    if (!editor || !onSave) return;
    const json = editor.getJSON();
    const html = editor.getHTML();
    const markdown = turndownService.turndown(html);
    onSave(json, markdown);
  };

  const handlePublish = () => {
    if (!editor || !onPublish) return;
    const json = editor.getJSON();
    const html = editor.getHTML();
    const markdown = turndownService.turndown(html);
    onPublish(json, markdown, title || "Untitled", hashtags);
  };

  const addHashtag = () => {
    if (hashtagInput.trim() && !hashtags.includes(hashtagInput.trim())) {
      setHashtags([...hashtags, hashtagInput.trim()]);
      setHashtagInput("");
    }
  };

  const removeHashtag = (tag: string) => {
    setHashtags(hashtags.filter((t) => t !== tag));
  };

  if (!editor) {
    return null;
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <input
          type="text"
          placeholder="Post title..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="text-4xl font-bold w-full border-none outline-none mb-4"
        />
        <div className="flex flex-wrap gap-2 mb-4">
          {hashtags.map((tag) => (
            <span
              key={tag}
              className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm flex items-center gap-2"
            >
              #{tag}
              <button
                onClick={() => removeHashtag(tag)}
                className="hover:text-blue-600"
              >
                ×
              </button>
            </span>
          ))}
          <input
            type="text"
            placeholder="Add hashtag..."
            value={hashtagInput}
            onChange={(e) => setHashtagInput(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addHashtag();
              }
            }}
            className="px-3 py-1 border rounded text-sm"
          />
        </div>
      </div>

      <div className="border rounded-lg mb-4">
        <div className="border-b p-2 flex gap-2">
          <button
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`px-3 py-1 rounded ${
              editor.isActive("bold") ? "bg-gray-200" : ""
            }`}
          >
            <strong>B</strong>
          </button>
          <button
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`px-3 py-1 rounded ${
              editor.isActive("italic") ? "bg-gray-200" : ""
            }`}
          >
            <em>I</em>
          </button>
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            className={`px-3 py-1 rounded ${
              editor.isActive("heading", { level: 1 }) ? "bg-gray-200" : ""
            }`}
          >
            H1
          </button>
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={`px-3 py-1 rounded ${
              editor.isActive("heading", { level: 2 }) ? "bg-gray-200" : ""
            }`}
          >
            H2
          </button>
          <button
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`px-3 py-1 rounded ${
              editor.isActive("bulletList") ? "bg-gray-200" : ""
            }`}
          >
            •
          </button>
          <button
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            className={`px-3 py-1 rounded ${
              editor.isActive("codeBlock") ? "bg-gray-200" : ""
            }`}
          >
            &lt;/&gt;
          </button>
          <button
            onClick={() => {
              const url = window.prompt("Enter image URL:");
              if (url) {
                editor.chain().focus().setImage({ src: url }).run();
              }
            }}
            className="px-3 py-1 rounded"
          >
            🖼️
          </button>
        </div>
        <EditorContent editor={editor} />
      </div>

      <div className="flex gap-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? "Saving..." : "Save Draft"}
        </button>
        <button
          onClick={handlePublish}
          disabled={saving}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? "Publishing..." : "Publish"}
        </button>
      </div>
    </div>
  );
}


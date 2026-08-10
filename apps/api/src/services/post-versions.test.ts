import { describe, expect, test } from "bun:test";
import { shouldCreatePostVersion, type PostVersionSnapshot } from "./post-versions";

const base: PostVersionSnapshot = {
  title: "Hello",
  content_markdown: "# Hi\n",
  content_blocks_json: { type: "doc", content: [] },
  summary: null,
  banner_url: null,
  hashtags: ["xlog"],
};

describe("shouldCreatePostVersion", () => {
  test("no-op when nothing changes", () => {
    expect(shouldCreatePostVersion(base, {})).toBe(false);
    expect(
      shouldCreatePostVersion(base, {
        title: "Hello",
        content_markdown: "# Hi\n",
        hashtags: ["xlog"],
      })
    ).toBe(false);
  });

  test("bumps on title or body change", () => {
    expect(shouldCreatePostVersion(base, { title: "Other" })).toBe(true);
    expect(shouldCreatePostVersion(base, { content_markdown: "# Bye\n" })).toBe(true);
  });

  test("bumps on hashtag reorder difference", () => {
    expect(shouldCreatePostVersion(base, { hashtags: ["blog", "xlog"] })).toBe(true);
    expect(shouldCreatePostVersion(base, { hashtags: ["xlog"] })).toBe(false);
  });

  test("bumps on content_blocks change", () => {
    expect(
      shouldCreatePostVersion(base, {
        content_blocks_json: {
          type: "doc",
          content: [{ type: "paragraph" }],
        },
      })
    ).toBe(true);
  });
});

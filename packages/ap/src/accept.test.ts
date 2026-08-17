import { describe, expect, test } from "bun:test";
import { createAcceptActivity, followObjectForAccept } from "./index";

describe("createAcceptActivity", () => {
  test("embeds Follow object like Threads/Mastodon", () => {
    const follow = followObjectForAccept(
      {
        id: "https://threads.net/ap/users/1/#follows/abc",
        type: "Follow",
        actor: "https://threads.net/ap/users/1/",
        object: "https://xlog.example/ap/users/alice",
      },
      {
        localActorId: "https://xlog.example/ap/users/alice",
        fallbackId: "https://xlog.example/ap/follows/fallback",
      }
    );

    expect(follow).toEqual({
      id: "https://threads.net/ap/users/1/#follows/abc",
      type: "Follow",
      actor: "https://threads.net/ap/users/1/",
      object: "https://xlog.example/ap/users/alice",
    });

    const accept = createAcceptActivity(
      "https://xlog.example/ap/activities/accept-1",
      "https://xlog.example/ap/users/alice",
      follow,
      ["https://threads.net/ap/users/1/"]
    );

    expect(accept.type).toBe("Accept");
    expect(accept.object).toEqual(follow);
    expect(JSON.stringify(accept.object)).not.toContain("@context");
    expect(accept.to).toEqual(["https://threads.net/ap/users/1/"]);
  });

  test("falls back to activity id string when actor missing", () => {
    const follow = followObjectForAccept(
      { id: "https://remote.example/follow/1", object: "https://xlog.example/ap/users/alice" },
      {
        localActorId: "https://xlog.example/ap/users/alice",
        fallbackId: "https://xlog.example/fallback",
      }
    );
    expect(follow).toBe("https://remote.example/follow/1");
  });

  test("synthesizes id when remote Follow omits id", () => {
    const follow = followObjectForAccept(
      {
        type: "Follow",
        actor: "https://remote.example/users/bob",
        object: "https://xlog.example/ap/users/alice",
      },
      {
        localActorId: "https://xlog.example/ap/users/alice",
        fallbackId: "https://xlog.example/ap/follows/fallback-1",
      }
    );
    expect(follow).toEqual({
      id: "https://xlog.example/ap/follows/fallback-1",
      type: "Follow",
      actor: "https://remote.example/users/bob",
      object: "https://xlog.example/ap/users/alice",
    });
  });
});

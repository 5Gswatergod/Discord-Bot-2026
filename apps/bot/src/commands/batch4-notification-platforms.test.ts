import assert from "node:assert/strict";
import test from "node:test";

import {
  buildSocialAlertSourceUrl,
  isSafePublicHttpUrl,
  socialAlertInputSchema,
  socialAlertTypes
} from "@guildforge/shared";

import {
  parseBlueskyEntries,
  parseJsonFeedEntries,
  parseRedditEntries,
  parseXmlFeedEntries
} from "../lib/social-alerts/feed-parsers";

test("includes all batch four notification platforms", () => {
  assert.deepEqual(socialAlertTypes, [
    "YOUTUBE",
    "TWITCH",
    "RSS",
    "TIKTOK",
    "X",
    "BLUESKY",
    "REDDIT",
    "INSTAGRAM",
    "KICK",
    "PODCAST"
  ]);
});

test("builds native Bluesky and Reddit source URLs", () => {
  assert.equal(
    buildSocialAlertSourceUrl("BLUESKY", "hydrava.bsky.social"),
    "https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=hydrava.bsky.social&filter=posts_no_replies&limit=20"
  );
  assert.equal(
    buildSocialAlertSourceUrl("REDDIT", "r/discordapp"),
    "https://www.reddit.com/r/discordapp/new/.rss"
  );
  assert.equal(
    buildSocialAlertSourceUrl(
      "REDDIT",
      "r/discordapp",
      "https://feeds.example.com/reddit/discordapp.json"
    ),
    "https://feeds.example.com/reddit/discordapp.json"
  );
});

test("requires public bridge URLs and valid mention settings", () => {
  const base = {
    sourceId: "hydrava",
    channelId: "12345",
    messageTemplate: "{mention}{title}\n{url}"
  };

  assert.equal(
    socialAlertInputSchema.safeParse({
      ...base,
      type: "X"
    }).success,
    false
  );
  assert.equal(
    socialAlertInputSchema.safeParse({
      ...base,
      type: "X",
      sourceUrl: "https://feeds.example.com/x/hydrava.json"
    }).success,
    true
  );
  assert.equal(
    socialAlertInputSchema.safeParse({
      ...base,
      type: "RSS",
      sourceId: "https://example.com/feed.xml",
      mentionEveryone: true,
      mentionRoleId: "23456"
    }).success,
    false
  );
  assert.equal(isSafePublicHttpUrl("http://127.0.0.1/feed"), false);
  assert.equal(isSafePublicHttpUrl("https://feeds.example.com/feed"), true);
});

test("parses XML, JSON Feed, and Bluesky entries", () => {
  const xmlEntries = parseXmlFeedEntries(`
    <rss><channel><item>
      <guid>post-1</guid>
      <title>Hydrava update</title>
      <link>https://example.com/post-1</link>
      <dc:creator>Eason</dc:creator>
      <pubDate>Sun, 22 Jun 2026 04:00:00 GMT</pubDate>
    </item></channel></rss>
  `);
  const jsonEntries = parseJsonFeedEntries(
    {
      version: "https://jsonfeed.org/version/1.1",
      items: [
        {
          id: "episode-1",
          title: "Episode 1",
          url: "https://example.com/episode-1",
          date_published: "2026-06-22T04:00:00Z",
          authors: [{ name: "Hydrava Podcast" }]
        }
      ]
    },
    "Podcast"
  );
  const blueskyEntries = parseBlueskyEntries({
    feed: [
      {
        post: {
          uri: "at://did:plc:test/app.bsky.feed.post/abc123",
          indexedAt: "2026-06-22T04:00:00Z",
          author: {
            handle: "hydrava.bsky.social",
            displayName: "Hydrava"
          },
          record: {
            text: "New Hydrava update",
            createdAt: "2026-06-22T04:00:00Z"
          }
        }
      }
    ]
  });
  const redditEntries = parseRedditEntries({
    data: {
      children: [
        {
          data: {
            name: "t3_abc123",
            title: "Hydrava on Reddit",
            permalink: "/r/discordapp/comments/abc123/hydrava/",
            author: "eason",
            created_utc: 1_750_566_400
          }
        }
      ]
    }
  });

  assert.equal(xmlEntries[0]?.id, "post-1");
  assert.equal(jsonEntries[0]?.author, "Hydrava Podcast");
  assert.equal(
    blueskyEntries[0]?.url,
    "https://bsky.app/profile/hydrava.bsky.social/post/abc123"
  );
  assert.equal(redditEntries[0]?.id, "t3_abc123");
});

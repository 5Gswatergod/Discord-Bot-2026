export type SocialAlertEntry = {
  id: string;
  title: string;
  url: string;
  author: string;
  publishedAt: string | null;
};

function decodeXml(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16))
    )
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 10)))
    .trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function readTag(block: string, tag: string) {
  const escapedTag = escapeRegExp(tag);
  const match = block.match(
    new RegExp(`<${escapedTag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escapedTag}>`, "i")
  );

  return match ? decodeXml(match[1]) : null;
}

function readLink(block: string) {
  const href = block.match(/<link\b[^>]*\bhref=["']([^"']+)["'][^>]*>/i)?.[1];

  return href ? decodeXml(href) : readTag(block, "link");
}

function sortEntries(entries: SocialAlertEntry[]) {
  return entries.sort((left, right) => {
    const leftTime = left.publishedAt ? Date.parse(left.publishedAt) : 0;
    const rightTime = right.publishedAt ? Date.parse(right.publishedAt) : 0;

    return rightTime - leftTime;
  });
}

export function parseXmlFeedEntries(xml: string): SocialAlertEntry[] {
  const entryMatches = [...xml.matchAll(/<entry\b[^>]*>([\s\S]*?)<\/entry>/gi)];
  const itemMatches = [...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)];
  const blocks = (entryMatches.length > 0 ? entryMatches : itemMatches).map((match) => match[1]);

  return sortEntries(
    blocks
      .map((block) => {
        const videoId = readTag(block, "yt:videoId");
        const url = videoId ? `https://www.youtube.com/watch?v=${videoId}` : readLink(block);
        const id = videoId ?? readTag(block, "id") ?? readTag(block, "guid") ?? url;
        const title =
          readTag(block, "title") ??
          readTag(block, "description")?.slice(0, 160) ??
          "新的通知內容";
        const author =
          readTag(block, "name") ??
          readTag(block, "author") ??
          readTag(block, "dc:creator") ??
          "未知作者";
        const publishedAt =
          readTag(block, "published") ?? readTag(block, "updated") ?? readTag(block, "pubDate");

        if (!id || !url) {
          return null;
        }

        return {
          id,
          title,
          url,
          author,
          publishedAt
        };
      })
      .filter((entry): entry is SocialAlertEntry => Boolean(entry))
  );
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function stringValue(...values: unknown[]) {
  const value = values.find(
    (candidate) =>
      (typeof candidate === "string" && candidate.trim().length > 0) ||
      typeof candidate === "number"
  );

  return value === undefined ? null : String(value).trim();
}

function authorName(item: Record<string, unknown>, fallback: string) {
  const authors = Array.isArray(item.authors) ? item.authors : [];
  const firstAuthor = asRecord(authors[0]);
  const author = asRecord(item.author);

  return (
    stringValue(
      firstAuthor?.name,
      firstAuthor?.displayName,
      author?.name,
      author?.displayName,
      item.author_name,
      typeof item.author === "string" ? item.author : null
    ) ?? fallback
  );
}

function itemContent(item: Record<string, unknown>) {
  return (
    stringValue(
      item.title,
      item.text,
      item.caption,
      item.content_text,
      item.description,
      item.content
    ) ?? "新的通知內容"
  )
    .replace(/<[^>]+>/g, "")
    .slice(0, 256);
}

export function parseJsonFeedEntries(payload: unknown, fallbackAuthor: string): SocialAlertEntry[] {
  const root = asRecord(payload);
  const candidates = Array.isArray(payload)
    ? payload
    : root
      ? [root.items, root.data, root.posts, root.entries].find(Array.isArray)
      : null;

  if (!Array.isArray(candidates)) {
    return [];
  }

  return sortEntries(
    candidates
      .map((candidate) => {
        const item = asRecord(candidate);

        if (!item) {
          return null;
        }

        const id = stringValue(item.id, item.guid, item.uri, item.external_id);
        const url = stringValue(item.url, item.external_url, item.link, item.permalink);

        if (!id || !url) {
          return null;
        }

        return {
          id,
          title: itemContent(item),
          url,
          author: authorName(item, fallbackAuthor),
          publishedAt: stringValue(
            item.date_published,
            item.date_modified,
            item.published_at,
            item.created_at,
            item.publishedAt,
            item.createdAt
          )
        };
      })
      .filter((entry): entry is SocialAlertEntry => Boolean(entry))
  );
}

export function parseBlueskyEntries(payload: unknown): SocialAlertEntry[] {
  const root = asRecord(payload);
  const feed = root && Array.isArray(root.feed) ? root.feed : [];

  return sortEntries(
    feed
      .map((candidate) => {
        const item = asRecord(candidate);
        const post = asRecord(item?.post);
        const author = asRecord(post?.author);
        const record = asRecord(post?.record);
        const uri = stringValue(post?.uri);
        const handle = stringValue(author?.handle);

        if (!uri || !handle) {
          return null;
        }

        const recordKey = uri.split("/").at(-1);

        if (!recordKey) {
          return null;
        }

        return {
          id: uri,
          title: (stringValue(record?.text) ?? "新的 Bluesky 貼文").slice(0, 256),
          url: `https://bsky.app/profile/${encodeURIComponent(handle)}/post/${encodeURIComponent(recordKey)}`,
          author: stringValue(author?.displayName, handle) ?? handle,
          publishedAt: stringValue(record?.createdAt, post?.indexedAt)
        };
      })
      .filter((entry): entry is SocialAlertEntry => Boolean(entry))
  );
}

export function parseRedditEntries(payload: unknown): SocialAlertEntry[] {
  const root = asRecord(payload);
  const data = asRecord(root?.data);
  const children = Array.isArray(data?.children) ? data.children : [];

  return sortEntries(
    children
      .map((candidate) => {
        const child = asRecord(candidate);
        const item = asRecord(child?.data);
        const id = stringValue(item?.name, item?.id);
        const permalink = stringValue(item?.permalink);

        if (!item || !id || !permalink) {
          return null;
        }

        const createdUtc =
          typeof item.created_utc === "number"
            ? new Date(item.created_utc * 1_000).toISOString()
            : stringValue(item.created_utc);

        return {
          id,
          title: itemContent(item),
          url: new URL(permalink, "https://www.reddit.com").toString(),
          author: stringValue(item.author) ?? "Reddit",
          publishedAt: createdUtc
        };
      })
      .filter((entry): entry is SocialAlertEntry => Boolean(entry))
  );
}

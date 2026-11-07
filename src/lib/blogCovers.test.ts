import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { POSTS } from "@/app/(marketing)/blog/posts";
import { ARTICLE_COVERS } from "./blogCovers";
import { finishMetadata } from "./seo/metadata";

test("every published article has a distinct cover that exists", () => {
  const covers = POSTS.map((post) => ARTICLE_COVERS[post.slug]);
  assert.ok(covers.every((cover) => cover?.alt && existsSync(`public${cover.src}`)));
  assert.equal(new Set(covers.map((cover) => cover.src)).size, POSTS.length);
});

test("article share metadata uses the article's cover", () => {
  const post = POSTS[0];
  const metadata = finishMetadata({ title: post.title, description: post.description, alternates: { canonical: `https://manpowersync.com/blog/${post.slug}` } });
  const images = metadata.openGraph?.images;
  assert.ok(Array.isArray(images));
  assert.equal((images[0] as { url: string }).url, ARTICLE_COVERS[post.slug].src);
});

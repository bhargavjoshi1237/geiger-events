import test from "node:test";
import assert from "node:assert/strict";
import { toEmbed } from "./video-embed.js";

const yt = (src) => ({ type: "iframe", src: `https://www.youtube-nocookie.com/embed/${src}` });

test("YouTube watch, short, embed and live links all embed", () => {
  assert.deepEqual(toEmbed("https://www.youtube.com/watch?v=abc123XYZ_-"), yt("abc123XYZ_-"));
  assert.deepEqual(toEmbed("https://youtu.be/abc123XYZ_-"), yt("abc123XYZ_-"));
  assert.deepEqual(toEmbed("https://www.youtube.com/shorts/abc123XYZ_-"), yt("abc123XYZ_-"));
  assert.deepEqual(toEmbed("https://www.youtube.com/live/abc123XYZ_-?si=x"), yt("abc123XYZ_-"));
});

test("Vimeo public, unlisted and channel links embed with the privacy hash kept", () => {
  assert.equal(toEmbed("https://vimeo.com/76979871").src, "https://player.vimeo.com/video/76979871");
  assert.equal(toEmbed("https://vimeo.com/76979871/8272103f6e").src, "https://player.vimeo.com/video/76979871?h=8272103f6e");
  assert.equal(toEmbed("https://vimeo.com/76979871?h=8272103f6e").src, "https://player.vimeo.com/video/76979871?h=8272103f6e");
  assert.equal(toEmbed("https://vimeo.com/channels/staffpicks/76979871").src, "https://player.vimeo.com/video/76979871");
  assert.equal(toEmbed("https://player.vimeo.com/video/76979871?h=8272103f6e").src, "https://player.vimeo.com/video/76979871?h=8272103f6e");
});

test("files and blanks", () => {
  assert.deepEqual(toEmbed("https://cdn.example.com/talk.mp4"), { type: "video", src: "https://cdn.example.com/talk.mp4" });
  assert.equal(toEmbed("").type, "none");
});

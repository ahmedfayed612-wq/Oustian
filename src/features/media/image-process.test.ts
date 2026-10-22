import test from "node:test";
import assert from "node:assert/strict";
import { fitDimensions } from "./image-process.ts";

test("fitDimensions leaves an image unchanged when already under the cap", () => {
  const out = fitDimensions(800, 600, 2048);
  assert.equal(out.width, 800);
  assert.equal(out.height, 600);
});

test("fitDimensions scales down the longest edge to the cap, preserving ratio", () => {
  const out = fitDimensions(4096, 3072, 2048);
  assert.equal(out.width, 2048);
  assert.equal(out.height, 1536);
});

test("fitDimensions handles portrait images", () => {
  const out = fitDimensions(1536, 4096, 2048);
  assert.equal(out.height, 2048);
  assert.equal(out.width, 768);
});

test("fitDimensions thumbnail target keeps aspect ratio", () => {
  const out = fitDimensions(2048, 1536, 480);
  assert.equal(out.width, 480);
  assert.equal(out.height, 360);
});

test("fitDimensions returns at least 1x1 for tiny inputs", () => {
  const out = fitDimensions(1, 1, 480);
  assert.equal(out.width, 1);
  assert.equal(out.height, 1);
});
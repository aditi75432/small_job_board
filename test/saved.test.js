import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../server.js";
import { loadJobs } from "../lib/jobs.js";
import { SavedStore, savedJobs } from "../lib/saved.js";

let dir, file, store, server, base;

// Each test gets its own temp file and its own server on a free port.
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "saved-"));
  file = join(dir, "saved.json");
  store = new SavedStore(file);
  server = createApp({ store });
  await new Promise((resolve) => server.listen(0, resolve));
  base = `http://localhost:${server.address().port}`;
});

afterEach(async () => {
  await new Promise((resolve) => server.close(resolve));
  await rm(dir, { recursive: true });
});

const post = (body) =>
  fetch(`${base}/api/saved`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

test("store starts empty when the file does not exist", async () => {
  assert.deepEqual(await store.list(), []);
});

test("store keeps one copy of an id and reports it", async () => {
  assert.equal(await store.add("j1"), true);
  assert.equal(await store.add("j1"), false);
  assert.deepEqual(await store.list(), ["j1"]);
});

test("store remove reports whether anything was removed", async () => {
  await store.add("j1");
  assert.equal(await store.remove("j1"), true);
  assert.equal(await store.remove("j1"), false);
  assert.deepEqual(await store.list(), []);
});

test("store handles many saves at once without losing any", async () => {
  await Promise.all(["j1", "j2", "j3", "j4"].map((id) => store.add(id)));
  assert.deepEqual((await store.list()).sort(), ["j1", "j2", "j3", "j4"]);
});

test("savedJobs keeps saved order and skips ids that no longer exist", async () => {
  const jobs = await loadJobs();
  assert.deepEqual(savedJobs(jobs, ["j3", "gone", "j1"]).map((j) => j.id), ["j3", "j1"]);
});

test("POST saves a job and GET lists it", async () => {
  const res = await post({ jobId: "j2" });
  assert.equal(res.status, 201);
  assert.equal((await res.json()).company, "Kite Learning");

  const saved = await (await fetch(`${base}/api/saved`)).json();
  assert.deepEqual(saved.map((j) => j.id), ["j2"]);
});

test("saving the same job twice keeps one copy", async () => {
  await post({ jobId: "j2" });
  const again = await post({ jobId: "j2" });
  assert.equal(again.status, 200);

  const saved = await (await fetch(`${base}/api/saved`)).json();
  assert.equal(saved.length, 1);
});

test("POST with an unknown job id gives a clear 404", async () => {
  const res = await post({ jobId: "nope" });
  assert.equal(res.status, 404);
  assert.match((await res.json()).error, /nope/);
  assert.deepEqual(await store.list(), []);
});

test("POST with a bad body gives 400, not a crash", async () => {
  assert.equal((await post("not json")).status, 400);
  assert.equal((await post({})).status, 400);
  assert.equal((await post({ jobId: 5 })).status, 400);
});

test("DELETE removes a saved job", async () => {
  await post({ jobId: "j1" });
  const res = await fetch(`${base}/api/saved/j1`, { method: "DELETE" });
  assert.equal(res.status, 200);
  assert.deepEqual(await (await fetch(`${base}/api/saved`)).json(), []);
});

test("DELETE on a job that is not saved gives 404", async () => {
  const res = await fetch(`${base}/api/saved/j1`, { method: "DELETE" });
  assert.equal(res.status, 404);
});

test("saved jobs survive a restart because they are in the file", async () => {
  await post({ jobId: "j4" });
  const onDisk = JSON.parse(await readFile(file, "utf8"));
  assert.deepEqual(onDisk, ["j4"]);
  assert.deepEqual(await new SavedStore(file).list(), ["j4"]);
});

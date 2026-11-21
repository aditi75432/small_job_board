import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../server.js";
import { filterJobs, filterOptions, loadJobs, sortJobs } from "../lib/jobs.js";
import { SavedStore } from "../lib/saved.js";

const ids = (jobs) => jobs.map((j) => j.id);

/* Pure functions */

test("filterJobs matches a location exactly, ignoring case", async () => {
  const jobs = await loadJobs();
  assert.deepEqual(ids(filterJobs(jobs, { location: "remote" })), ["j1", "j3", "j6", "j8"]);
  assert.deepEqual(ids(filterJobs(jobs, { location: "Delhi NCR" })), ["j7"]);
});

test("filterJobs keeps jobs that pay at least the minimum", async () => {
  const jobs = await loadJobs();
  assert.deepEqual(ids(filterJobs(jobs, { minStipend: 12000 })), ["j1", "j2", "j5", "j6"]);
});

test("filterJobs combines location and stipend, and no options keeps everything", async () => {
  const jobs = await loadJobs();
  assert.deepEqual(ids(filterJobs(jobs, { location: "Remote", minStipend: 10000 })), ["j1", "j6"]);
  assert.equal(filterJobs(jobs).length, jobs.length);
  assert.deepEqual(filterJobs(jobs, { location: "Goa" }), []);
});

test("sortJobs orders by stipend, keeps ties in file order and does not change the input", async () => {
  const jobs = await loadJobs();
  const before = ids(jobs);
  assert.deepEqual(ids(sortJobs(jobs, "stipend-desc")), ["j6", "j2", "j5", "j1", "j4", "j8", "j3", "j7"]);
  assert.deepEqual(ids(sortJobs(jobs, "stipend-asc")), ["j3", "j7", "j8", "j4", "j1", "j2", "j5", "j6"]);
  assert.deepEqual(ids(sortJobs(jobs, "")), before);
  assert.deepEqual(ids(jobs), before);
});

test("filterOptions lists each location and stipend once, in order", async () => {
  const { locations, stipends } = filterOptions(await loadJobs());
  assert.deepEqual(locations, ["Bengaluru", "Delhi NCR", "Mumbai", "Pune", "Remote"]);
  assert.deepEqual(stipends, [8000, 9000, 10000, 12000, 15000, 20000]);
});

/* The API */

let dir, server, base;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "filters-"));
  server = createApp({ store: new SavedStore(join(dir, "saved.json")) });
  await new Promise((resolve) => server.listen(0, resolve));
  base = `http://localhost:${server.address().port}`;
});

afterEach(async () => {
  await new Promise((resolve) => server.close(resolve));
  await rm(dir, { recursive: true });
});

const getJobs = async (query) => (await fetch(`${base}/api/jobs?${query}`)).json();

test("GET /api/jobs with no filters still returns every job", async () => {
  assert.equal((await getJobs("")).length, 8);
});

test("GET /api/jobs filters by location and minimum stipend", async () => {
  assert.deepEqual(ids(await getJobs("location=Remote&minStipend=10000")), ["j1", "j6"]);
});

test("GET /api/jobs combines search, filters and sort", async () => {
  const jobs = await getJobs("q=intern&location=Remote&sort=stipend-desc");
  assert.deepEqual(ids(jobs), ["j6", "j1", "j8", "j3"]);
});

test("GET /api/jobs rejects a bad minStipend or sort with a clear 400", async () => {
  for (const query of ["minStipend=lots", "minStipend=-5", "sort=random"]) {
    const res = await fetch(`${base}/api/jobs?${query}`);
    assert.equal(res.status, 400, query);
    assert.ok((await res.json()).error.length > 0);
  }
});

test("GET /api/jobs/options returns the values for the filters", async () => {
  const options = await (await fetch(`${base}/api/jobs/options`)).json();
  assert.ok(options.locations.includes("Remote"));
  assert.equal(options.stipends[0], 8000);
});

/* The page */

test("the page and its stylesheet are served", async () => {
  const page = await fetch(`${base}/`);
  assert.equal(page.status, 200);
  const html = await page.text();
  for (const id of ["search", "location", "min-stipend", "sort", "saved"]) {
    assert.ok(html.includes(`id="${id}"`), `missing #${id}`);
  }
  const css = await fetch(`${base}/styles.css`);
  assert.equal(css.status, 200);
  assert.match(css.headers.get("content-type"), /text\/css/);
});

test("files outside the public list are not served", async () => {
  assert.equal((await fetch(`${base}/server.js`)).status, 404);
  assert.equal((await fetch(`${base}/../package.json`)).status, 404);
});

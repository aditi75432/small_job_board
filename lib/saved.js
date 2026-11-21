// Saved jobs, kept as a list of job ids in a JSON file.
// Only ids are stored, so a job's details always come from jobs.json.
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const DEFAULT_SAVED_PATH = new URL("../saved.json", import.meta.url);

export class SavedStore {
  constructor(path = DEFAULT_SAVED_PATH) {
    this.path = path instanceof URL ? fileURLToPath(path) : path;
    // Changes run one after another so two requests cannot overwrite each other.
    this.queue = Promise.resolve();
  }

  /** Saved job ids, oldest first. A missing file means nothing is saved yet. */
  async list() {
    try {
      return JSON.parse(await readFile(this.path, "utf8"));
    } catch (err) {
      if (err.code === "ENOENT") return [];
      throw err;
    }
  }

  /** Saves an id. Returns false if it was already saved. */
  add(id) {
    return this.#change((ids) => (ids.includes(id) ? null : [...ids, id]));
  }

  /** Removes an id. Returns false if it was not saved. */
  remove(id) {
    return this.#change((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : null));
  }

  // `update` gets the current ids and returns the new ids, or null for no change.
  #change(update) {
    const run = this.queue.then(async () => {
      const next = update(await this.list());
      if (next === null) return false;
      await this.#write(next);
      return true;
    });
    // Keep the queue alive even if this change fails.
    this.queue = run.catch(() => {});
    return run;
  }

  // Write to a temp file first so a crash cannot leave half a file behind.
  async #write(ids) {
    await mkdir(dirname(this.path), { recursive: true });
    const tmp = `${this.path}.tmp`;
    await writeFile(tmp, JSON.stringify(ids, null, 2));
    await rename(tmp, this.path);
  }
}

/** Turns saved ids into full jobs, in saved order. Ids missing from jobs are skipped. */
export function savedJobs(jobs, ids) {
  const byId = new Map(jobs.map((j) => [j.id, j]));
  return ids.map((id) => byId.get(id)).filter(Boolean);
}

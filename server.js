// A small job board: a JSON API and one page. Run with `npm start`.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { findJob, loadJobs, searchJobs } from "./lib/jobs.js";
import { SavedStore, savedJobs } from "./lib/saved.js";

const PORT = Number(process.env.PORT ?? 3000);

function sendJson(res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

const MAX_BODY_BYTES = 10_000;

// An error that should reach the client as a specific status and message.
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function readJsonBody(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new HttpError(413, "Request body is too large");
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpError(400, "Request body must be valid JSON");
  }
}

// `store` is passed in so tests can use a temporary file.
export function createApp({ store = new SavedStore() } = {}) {
  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://localhost");
      if (req.method === "GET" && url.pathname === "/api/jobs") {
        const jobs = await loadJobs();
        return sendJson(res, 200, searchJobs(jobs, url.searchParams.get("q")));
      }

      if (url.pathname === "/api/saved" && req.method === "GET") {
        return sendJson(res, 200, savedJobs(await loadJobs(), await store.list()));
      }
      if (url.pathname === "/api/saved" && req.method === "POST") {
        const { jobId } = (await readJsonBody(req)) ?? {};
        if (typeof jobId !== "string" || !jobId) throw new HttpError(400, "jobId is required");
        const job = findJob(await loadJobs(), jobId);
        if (!job) throw new HttpError(404, `No job with id "${jobId}"`);
        // 201 for a new save, 200 if it was already saved. Either way there is one copy.
        const added = await store.add(jobId);
        return sendJson(res, added ? 201 : 200, job);
      }
      if (url.pathname.startsWith("/api/saved/") && req.method === "DELETE") {
        let jobId;
        try {
          jobId = decodeURIComponent(url.pathname.slice("/api/saved/".length));
        } catch {
          throw new HttpError(400, "Job id is not valid");
        }
        if (!(await store.remove(jobId))) throw new HttpError(404, `Job "${jobId}" is not saved`);
        return sendJson(res, 200, { removed: jobId });
      }

      if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/app.js")) {
        const file = url.pathname === "/" ? "index.html" : "app.js";
        const type = file.endsWith(".html") ? "text/html" : "text/javascript";
        const body = await readFile(new URL(`./public/${file}`, import.meta.url));
        res.writeHead(200, { "content-type": `${type}; charset=utf-8` });
        return res.end(body);
      }
      sendJson(res, 404, { error: "Not found" });
    } catch (err) {
      if (err instanceof HttpError) return sendJson(res, err.status, { error: err.message });
      console.error(err);
      sendJson(res, 500, { error: "Something went wrong" });
    }
  });
}

// Started directly (npm start), not imported by a test.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  createApp().listen(PORT, () => console.log(`Job board on http://localhost:${PORT}`));
}

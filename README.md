# Job board starter

A small job board for an insiderOne work sample. It is made up: the jobs and
companies are not real.

## Run it

You need Node 20 or newer. There are no packages to install.

```
npm start      # then open http://localhost:3000
npm test       # runs the tests in test/
```

## What is here

- `server.js`: the web server. `GET /api/jobs?q=` lists jobs, `GET /` serves the page.
- `lib/jobs.js`: reading and searching the jobs. Pure functions.
- `jobs.json`: the jobs.
- `public/`: the page and its script.
- `test/`: tests, using Node's built-in test runner.

## Saved jobs

### What I built

- A Save button on every job, and a Saved jobs list on the same page with a Remove button.
- `POST /api/saved` with `{ "jobId": "..." }`, `GET /api/saved`, `DELETE /api/saved/:jobId`.
- Saving the same job twice keeps one copy. An unknown id returns a 404 with a message, a bad body returns a 400.
- Saved jobs are kept in `saved.json` (created on first save, ignored by git), so they survive a reload and a restart.

### Files I added or changed

- `lib/saved.js`: `SavedStore` (reads and writes the JSON file) and `savedJobs` (ids to full jobs).
- `server.js`: the three routes, JSON body reading, and a small `HttpError` so errors carry their status.
- `public/app.js`, `public/index.html`: the buttons and the saved list.
- `test/saved.test.js`: tests for the store and the API.

### Run the tests

```
npm test
```

The API tests start the server on a free port with a temporary file, so they never touch your real `saved.json`.

### One decision and why

I store only job ids in `saved.json`, not copies of the jobs. If a job is edited in `jobs.json`, the saved list shows the new details, and the two files cannot disagree. The cost is one extra lookup per request, which is fine at this size.

### What I would do next

- Give each student their own saved list (needs a login or at least a user id).
- Replace the JSON file with a database once more than one server process runs, since the write queue only protects a single process.
- Show a message on the page instead of an alert when a request fails.

### Tool use


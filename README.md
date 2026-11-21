# Job board with saved jobs

A small job board for an insiderOne work sample. The jobs and companies are made up.
Students can search and filter jobs, save the ones they like, and come back to them later.

## How it looks

**Main page.** Jobs with their location and stipend, the search box, filters and the saved panel.

![Main page with the job list, filters and saved panel](https://github.com/user-attachments/assets/e1861a14-ce6e-40b8-a127-eee7c94e93f6)

**Saving a job.** The button turns into a filled "Saved", the header badge counts saved jobs, and the job appears in the saved panel.

![A saved job shown in the saved panel](https://github.com/user-attachments/assets/f760c77c-7d20-47ae-9b4b-c779d309a607)

**Search and filters.** Search, location, minimum stipend and sort work together, with a Clear filters button.

![Jobs narrowed down by search and filters](https://github.com/user-attachments/assets/42e653c4-5922-4f40-b65c-0f9118271c2b)

**Tests.** All tests passing with `npm test`.

![Terminal showing all tests passing](https://github.com/user-attachments/assets/a68587b2-db3e-4bab-9ad4-26d92a62a2e6)

## Demo 

https://github.com/user-attachments/assets/fac79c0d-b8d8-476c-a20a-dde2a826c8d3


## Run it

You need Node 20 or newer. There are no packages to install.

```
npm start      # then open http://localhost:3000
npm test       # runs every test in test/
```

## What it does

- **Browse and search.** Type in the search box to match a title, company or place.
- **Filter.** Narrow by location and by minimum stipend. The choices in those dropdowns are read from the jobs themselves, so they are always correct.
- **Sort.** Order by stipend, high to low or low to high.
- **Save.** The Save button on a job turns into a filled "Saved" button. Press it again to unsave.
- **Saved jobs panel.** Every saved job is listed on the same page with a Remove button. A badge in the header shows how many are saved.
- **Feedback.** Short messages confirm each action, a removal can be undone, and errors are shown on the page.
- **Persistence.** Saved jobs are kept in `saved.json` on the server, so they survive a reload and a restart.

## API

| Method and path | What it does |
| --- | --- |
| `GET /api/jobs` | Lists jobs. Optional `q`, `location`, `minStipend` and `sort` (`stipend-desc` or `stipend-asc`). They combine. |
| `GET /api/jobs/options` | The locations and stipend values the filters can offer. |
| `POST /api/saved` with `{ "jobId": "j1" }` | Saves a job. 201 if new, 200 if it was already saved (still one copy). 404 for an unknown id, 400 for a bad body. |
| `GET /api/saved` | The saved jobs, in the order they were saved. |
| `DELETE /api/saved/:jobId` | Removes a saved job. 404 if it was not saved. |

Errors always come back as `{ "error": "..." }` with a message a person can read.

## How the code is laid out

- `server.js`: routes, reading the request body, turning errors into status codes. It only serves the three files in `STATIC_FILES`, so no URL can reach other files.
- `lib/jobs.js`: reading, searching, filtering and sorting jobs. Pure functions, so they are easy to test.
- `lib/saved.js`: `SavedStore`, which keeps saved job ids in the JSON file, and `savedJobs`, which turns ids into full jobs.
- `public/index.html`, `public/styles.css`, `public/app.js`: the page, its look, and its behaviour.
- `test/`: tests with Node's built-in runner. `jobs.test.js` is from the starter, `saved.test.js` covers saving, `filters.test.js` covers filtering, sorting and the page.

## Decisions and why

**1. Save only job ids, not copies of the jobs.**
If a job changes in `jobs.json`, the saved list shows the new details and the two can never disagree. The cost is one extra lookup per request, which is fine at this size. A saved id whose job was deleted is skipped quietly instead of causing an error.

**2. Writes go through a queue, and each write goes to a temp file first.**
Two requests at the same time could both read the file, then each write their own change and lose the other. Running changes one after another prevents that. Writing to a temp file and renaming it means a crash mid-write cannot leave a half-written `saved.json`. I tested the concurrent case.

**3. Filtering happens on the server, in plain functions.**
The page could filter in the browser, but then the logic would live in code I cannot test with Node's test runner and no packages. On the server it is a few small functions with clear tests, and the page stays simple. The page also ignores a slow old response if a newer search has already started, so results never flicker back to an old search.

**4. The filter choices come from the data, not from a fixed list.**
`/api/jobs/options` returns the locations and stipends that exist. If someone adds a job in a new city, it shows up in the dropdown with no code change.

**5. Bad input gets a clear 400 or 404, not a crash.**
For example `minStipend=lots`, `sort=random`, invalid JSON, or an unknown job id.

## Testing

`npm test` runs 27 tests. They cover:

- the store: empty start, no duplicates, remove, many saves at once, saved order;
- the saved API: save, list, save twice, unknown id, bad body, remove, removing something not saved, survival across restarts;
- filtering and sorting: each filter alone and together, ties keep their order, the input list is not changed;
- the filter API, including the error cases and the options endpoint;
- the page and stylesheet are served, and other files such as `server.js` are not.

The API tests start the server on a free port with a temporary file, so they never touch your real `saved.json`.

```
> job-board-starter@1.0.0 test
> node --test

✔ filterJobs matches a location exactly, ignoring case (21.9543ms)
✔ filterJobs keeps jobs that pay at least the minimum (5.6667ms)
✔ filterJobs combines location and stipend, and no options keeps everything (6.0018ms)
✔ sortJobs orders by stipend, keeps ties in file order and does not change the input (6.6057ms)
✔ filterOptions lists each location and stipend once, in order (21.0027ms)
✔ GET /api/jobs with no filters still returns every job (76.7214ms)
✔ GET /api/jobs filters by location and minimum stipend (11.4247ms)
✔ GET /api/jobs combines search, filters and sort (14.8998ms)
✔ GET /api/jobs rejects a bad minStipend or sort with a clear 400 (17.4779ms)
✔ GET /api/jobs/options returns the values for the filters (10.9594ms)
✔ the page and its stylesheet are served (19.9949ms)
✔ files outside the public list are not served (17.386ms)
✔ loads the jobs file (8.7998ms)
✔ search matches title, company and place, ignoring case (2.9146ms)
✔ findJob returns null for an unknown id (1.9885ms)
✔ store starts empty when the file does not exist (21.7386ms)
✔ store keeps one copy of an id and reports it (15.2338ms)
✔ store remove reports whether anything was removed (12.6282ms)
✔ store handles many saves at once without losing any (26.4686ms)
✔ savedJobs keeps saved order and skips ids that no longer exist (4.7439ms)
✔ POST saves a job and GET lists it (94.6869ms)
✔ saving the same job twice keeps one copy (37.9776ms)
✔ POST with an unknown job id gives a clear 404 (12.5475ms)
✔ POST with a bad body gives 400, not a crash (20.5945ms)
✔ DELETE removes a saved job (28.3934ms)
✔ DELETE on a job that is not saved gives 404 (10.4741ms)
✔ saved jobs survive a restart because they are in the file (17.0022ms)
ℹ tests 27
ℹ suites 0
ℹ pass 27
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 434.8578
```

## What I would do next

- Give each student their own saved list. That needs a login, or at least a user id on each request.
- Move from the JSON file to a database once more than one server process runs, because the write queue only protects a single process.
- Keep the search and filters in the page URL, so a search can be shared or bookmarked.
- Add browser tests for the page once packages are allowed.

## Tool use

I used Claude (an AI assistant by Anthropic) to review this submission and check if I could improve anything. It wrote the draft of README.md and improved the UI/UX for the application.

## What I did myself

I wrote the first version of `lib/saved.js`, the new routes in `server.js`, the changes to
`public/app.js` and `public/index.html`, `test/saved.test.js`, the filtering functions in `lib/jobs.js` I ran the app and the tests on my own machine, read through every file, and tried save, reload and remove in the browser. I understand how the save queue and the id-only storage work and can explain them.


const list = document.getElementById("jobs");
const savedList = document.getElementById("saved");
const savedEmpty = document.getElementById("saved-empty");
const search = document.getElementById("search");

// Ids of saved jobs, so each Save button knows whether to be disabled.
let savedIds = new Set();
// Last search text, so the list can be redrawn after a save or remove.
let query = "";

function describe(job) {
  return `${job.title} at ${job.company}, ${job.location}. Rs ${job.stipend.toLocaleString("en-IN")} a month.`;
}

function addButton(li, label, onClick, disabled = false) {
  const button = document.createElement("button");
  button.textContent = label;
  button.disabled = disabled;
  button.addEventListener("click", onClick);
  li.append(button);
}

async function showJobs() {
  const res = await fetch(`/api/jobs?q=${encodeURIComponent(query)}`);
  const jobs = await res.json();
  list.innerHTML = "";
  for (const job of jobs) {
    const li = document.createElement("li");
    li.append(describe(job));
    const isSaved = savedIds.has(job.id);
    addButton(li, isSaved ? "Saved" : "Save", () => save(job.id), isSaved);
    list.append(li);
  }
}

async function showSaved() {
  const res = await fetch("/api/saved");
  const jobs = await res.json();
  savedIds = new Set(jobs.map((j) => j.id));
  savedList.innerHTML = "";
  savedEmpty.hidden = jobs.length > 0;
  for (const job of jobs) {
    const li = document.createElement("li");
    li.append(describe(job));
    addButton(li, "Remove", () => remove(job.id));
    savedList.append(li);
  }
}

// Redraw both lists so the buttons match what the server has.
async function refresh() {
  await showSaved();
  await showJobs();
}

async function save(jobId) {
  const res = await fetch("/api/saved", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jobId }),
  });
  if (!res.ok) await reportError(res);
  await refresh();
}

async function remove(jobId) {
  const res = await fetch(`/api/saved/${encodeURIComponent(jobId)}`, { method: "DELETE" });
  if (!res.ok) await reportError(res);
  await refresh();
}

async function reportError(res) {
  const { error } = await res.json().catch(() => ({}));
  alert(error ?? "Something went wrong, please try again.");
}

search.addEventListener("input", () => {
  query = search.value;
  showJobs();
});
refresh();

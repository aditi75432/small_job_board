// The job board page. Server calls are in `api`, drawing is in the render functions.

const $ = (id) => document.getElementById(id);
const els = {
  search: $("search"),
  location: $("location"),
  minStipend: $("min-stipend"),
  sort: $("sort"),
  clear: $("clear"),
  count: $("count"),
  jobs: $("jobs"),
  jobsEmpty: $("jobs-empty"),
  saved: $("saved"),
  savedEmpty: $("saved-empty"),
  savedCount: $("saved-count"),
  toast: $("toast"),
};

// Ids of saved jobs, so each card knows whether it is saved.
let savedIds = new Set();
// Bumped on every search. A slow older response is dropped if a newer one started.
let latestSearch = 0;

/* Server calls */

async function api(path, options) {
  const res = await fetch(path, options);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? "Something went wrong, please try again.");
  return body;
}

const saveJob = (jobId) =>
  api("/api/saved", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jobId }),
  });

const unsaveJob = (jobId) => api(`/api/saved/${encodeURIComponent(jobId)}`, { method: "DELETE" });

/* Small helpers for building the page */

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const rupees = (n) => `Rs ${n.toLocaleString("en-IN")}`;

// Fixed markup, no user data, so innerHTML is safe here.
function bookmarkIcon(filled) {
  return `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 1.5h10v13l-5-3.5-5 3.5z" fill="${filled ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>`;
}

/* Rendering */

function jobCard(job, { compact = false } = {}) {
  const li = el("li", "card");
  const info = el("div");
  info.append(el("h3", "", job.title), el("p", "company", job.company));
  if (!compact) {
    const meta = el("div", "meta");
    meta.append(el("span", "pill", job.location), el("span", "pill pay", `${rupees(job.stipend)} a month`));
    info.append(meta);
  }
  li.append(info);

  const button = el("button", "btn");
  button.type = "button";
  if (compact) {
    button.classList.add("remove");
    button.textContent = "Remove";
    button.setAttribute("aria-label", `Remove ${job.title} at ${job.company} from saved jobs`);
    button.addEventListener("click", () => toggleSave(job));
  } else {
    const isSaved = savedIds.has(job.id);
    button.setAttribute("aria-pressed", String(isSaved));
    button.innerHTML = `${bookmarkIcon(isSaved)}${isSaved ? "Saved" : "Save"}`;
    button.setAttribute("aria-label", `${isSaved ? "Unsave" : "Save"} ${job.title} at ${job.company}`);
    button.addEventListener("click", () => toggleSave(job));
  }
  li.append(button);
  return li;
}

function renderJobs(jobs) {
  els.jobs.replaceChildren(...jobs.map((job) => jobCard(job)));
  els.jobsEmpty.hidden = jobs.length > 0;
}

function renderSaved(jobs) {
  els.saved.replaceChildren(...jobs.map((job) => jobCard(job, { compact: true })));
  els.savedEmpty.hidden = jobs.length > 0;
  els.savedCount.textContent = String(jobs.length);
}

/* Filters */

function currentFilters() {
  return {
    q: els.search.value.trim(),
    location: els.location.value,
    minStipend: els.minStipend.value,
    sort: els.sort.value,
  };
}

// Sorting is a preference, not a filter, so it does not count here.
function hasActiveFilters() {
  const { q, location, minStipend } = currentFilters();
  return Boolean(q || location || minStipend);
}

function clearFilters() {
  els.search.value = "";
  els.location.value = "";
  els.minStipend.value = "";
  els.sort.value = "";
  loadJobs();
}

async function loadOptions() {
  const { locations, stipends } = await api("/api/jobs/options");
  for (const place of locations) els.location.append(new Option(place, place));
  for (const amount of stipends) els.minStipend.append(new Option(`${rupees(amount)} or more`, amount));
}

/* Loading data */

async function loadJobs() {
  const thisSearch = ++latestSearch;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(currentFilters())) if (value) params.set(key, value);

  try {
    const jobs = await api(`/api/jobs?${params}`);
    if (thisSearch !== latestSearch) return;
    renderJobs(jobs);
    els.count.textContent = `${jobs.length} ${jobs.length === 1 ? "job" : "jobs"} found`;
    els.clear.hidden = !hasActiveFilters();
  } catch (err) {
    if (thisSearch === latestSearch) showToast(err.message, { error: true });
  }
}

async function loadSaved() {
  const jobs = await api("/api/saved");
  savedIds = new Set(jobs.map((j) => j.id));
  renderSaved(jobs);
}

// Redraw both lists so the buttons match what the server has.
async function refresh() {
  await loadSaved();
  await loadJobs();
}

/* Saving and removing */

async function toggleSave(job) {
  const wasSaved = savedIds.has(job.id);
  try {
    if (wasSaved) {
      await unsaveJob(job.id);
      showToast(`Removed ${job.title}`, { undo: () => toggleSave(job) });
    } else {
      await saveJob(job.id);
      showToast(`Saved ${job.title}`);
    }
  } catch (err) {
    showToast(err.message, { error: true });
  }
  await refresh();
}

/* Toast message at the bottom of the screen */

let toastTimer;

function showToast(message, { error = false, undo } = {}) {
  els.toast.replaceChildren(message);
  els.toast.className = error ? "toast error" : "toast";
  if (undo) {
    const button = el("button", "", "Undo");
    button.type = "button";
    button.addEventListener("click", () => {
      els.toast.hidden = true;
      undo();
    });
    els.toast.append(button);
  }
  els.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (els.toast.hidden = true), 4000);
}

/* Start */

// Wait a moment after typing stops, so we do not search on every key press.
let typingTimer;
els.search.addEventListener("input", () => {
  clearTimeout(typingTimer);
  typingTimer = setTimeout(loadJobs, 200);
});
for (const select of [els.location, els.minStipend, els.sort]) select.addEventListener("change", loadJobs);
els.clear.addEventListener("click", clearFilters);

loadOptions()
  .then(refresh)
  .catch((err) => showToast(err.message, { error: true }));

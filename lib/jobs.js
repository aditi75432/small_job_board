// Reading and filtering the jobs. Pure functions, so they are easy to test.
import { readFile } from "node:fs/promises";

export async function loadJobs(path = new URL("../jobs.json", import.meta.url)) {
  const raw = await readFile(path, "utf8");
  return JSON.parse(raw);
}

/** Jobs whose title, company or location contains the search words. */
export function searchJobs(jobs, query) {
  const q = String(query ?? "").trim().toLowerCase();
  if (!q) return jobs;
  return jobs.filter((j) => [j.title, j.company, j.location].some((f) => String(f).toLowerCase().includes(q)));
}

export function findJob(jobs, id) {
  return jobs.find((j) => j.id === id) ?? null;
}

/** Sort orders the API accepts. An empty string keeps the file order. */
export const SORTS = ["", "stipend-desc", "stipend-asc"];

/** Jobs in one place (ignoring case) and paying at least `minStipend`. Empty options keep everything. */
export function filterJobs(jobs, { location = "", minStipend = 0 } = {}) {
  const place = String(location).trim().toLowerCase();
  return jobs.filter(
    (j) => (!place || j.location.toLowerCase() === place) && j.stipend >= minStipend,
  );
}

/** A sorted copy. Jobs with equal stipends keep their original order. */
export function sortJobs(jobs, sort = "") {
  if (sort === "stipend-desc") return [...jobs].sort((a, b) => b.stipend - a.stipend);
  if (sort === "stipend-asc") return [...jobs].sort((a, b) => a.stipend - b.stipend);
  return jobs;
}

/** The values the page offers in its filters, taken from the jobs themselves. */
export function filterOptions(jobs) {
  const unique = (values) => [...new Set(values)];
  return {
    locations: unique(jobs.map((j) => j.location)).sort((a, b) => a.localeCompare(b)),
    stipends: unique(jobs.map((j) => j.stipend)).sort((a, b) => a - b),
  };
}

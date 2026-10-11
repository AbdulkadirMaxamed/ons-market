import { useMemo, useRef, useState } from "react";
import { Form, useNavigate } from "react-router";

import { findJobs, findPlaces, placeHint, resolveSearch, type JobItem, type PlaceItem } from "~/lib/search";
import type { SearchIndex } from "~/lib/types";
import { Combobox } from "./Combobox";

/**
 * Job + place search. The list of jobs and places is the static /data/search.json, fetched by the browser the first
 * time someone focuses a box, so typing never costs Worker CPU. Without JavaScript the form submits to the homepage
 * loader, which resolves the text the same way and redirects.
 */
export function SearchForm({
  initial,
  error: serverError,
}: {
  initial?: { job?: string; where?: string };
  error?: { field: "job" | "where"; message: string } | null;
}) {
  const navigate = useNavigate();
  const [index, setIndex] = useState<SearchIndex | null>(null);
  const loading = useRef<Promise<SearchIndex | null> | null>(null); // fetch once
  const [job, setJob] = useState(initial?.job ?? "");
  const [where, setWhere] = useState(initial?.where ?? "");
  const [jobSlug, setJobSlug] = useState<string | null>(null);
  const [whereSlug, setWhereSlug] = useState<string | null>(null);
  const [error, setError] = useState(serverError ?? null);
  const jobRef = useRef<HTMLInputElement>(null);
  const whereRef = useRef<HTMLInputElement>(null);

  const load = () => {
    loading.current ??= fetch("/data/search.json")
      .then((r) => (r.ok ? (r.json() as Promise<SearchIndex>) : null))
      .then((data) => {
        setIndex(data);
        return data;
      })
      .catch(() => null); // the form still works through the server
  };

  const jobOptions = useMemo(() => (index && job.trim() ? findJobs(index.occupations, job) : []), [index, job]);
  const placeOptions = useMemo(() => (index && where.trim() ? findPlaces(index.places, where) : []), [index, where]);

  return (
    <Form
      method="get"
      action="/"
      noValidate
      className="mt-8 grid max-w-[780px] gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end"
      onSubmit={(e) => {
        if (!index) return; // list not loaded yet: the form goes to the homepage loader, which resolves it the same way
        e.preventDefault();
        const r = resolveSearch(index, { job, where, jobSlug, whereSlug });
        if (r.ok) navigate(r.href);
        else {
          setError(r);
          (r.field === "job" ? jobRef : whereRef).current?.focus();
        }
      }}
    >
      <Combobox<JobItem>
        label="Job"
        name="job"
        placeholder="Software developer"
        value={job}
        onChange={(t) => {
          setJob(t);
          setJobSlug(null);
          if (error?.field === "job") setError(null);
        }}
        options={jobOptions}
        optionKey={(o) => o.soc}
        renderOption={(o) => (
          <>
            {o.name}
            <small className="block text-[12.5px] text-ink-3">{o.ons ? `ONS: ${o.ons}` : `SOC ${o.soc}`}</small>
          </>
        )}
        onPick={(o) => {
          setJob(o.name);
          setJobSlug(o.slug);
        }}
        onFocus={load}
        error={error?.field === "job"}
        describedBy={error?.field === "job" ? "search-error" : undefined}
        inputRef={jobRef}
      />
      <Combobox<PlaceItem>
        label="Where"
        name="where"
        placeholder="Manchester, or leave blank for the UK"
        value={where}
        onChange={(t) => {
          setWhere(t);
          setWhereSlug(null);
          if (error?.field === "where") setError(null);
        }}
        options={placeOptions}
        optionKey={(o) => o.code}
        renderOption={(o) => (
          <>
            {o.name}
            <small className="block text-[12.5px] text-ink-3">{index ? placeHint(o, index) : ""}</small>
          </>
        )}
        onPick={(o) => {
          setWhere(o.name);
          setWhereSlug(o.slug);
        }}
        onFocus={load}
        error={error?.field === "where"}
        describedBy={error?.field === "where" ? "search-error" : undefined}
        inputRef={whereRef}
      />
      {jobSlug && <input type="hidden" name="jobSlug" value={jobSlug} />}
      {whereSlug && <input type="hidden" name="whereSlug" value={whereSlug} />}
      <button className="min-h-[54px] cursor-pointer rounded-card bg-accent px-6 font-medium text-accent-ink">
        Check the market
      </button>
      <p id="search-error" role="alert" className="min-h-[1.5em] text-[14.5px] text-down md:col-span-3">
        {error?.message}
      </p>
    </Form>
  );
}

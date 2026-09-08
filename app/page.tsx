import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AppSearch } from "@/components/search/app-search";
import { parseSearchState } from "@/lib/search";
import { loadSearch, loadAreaSelection } from "@/lib/search-loader";
import { getSession } from "@/lib/session";
import type { UrlParamsRecord } from "@/lib/url-params";

type SearchPageProps = {
  searchParams: Promise<UrlParamsRecord>;
};

export async function generateMetadata({ searchParams }: SearchPageProps): Promise<Metadata> {
  // Any param at all is a search/filter state (see the page body) — infinite
  // and low-value as a landing page, so it's kept out of the index and
  // canonicalized to the bare, unfiltered search page.
  const isSearch = Object.keys(await searchParams).length > 0;
  return isSearch
    ? { title: "Search", robots: { index: false }, alternates: { canonical: "/" } }
    : { alternates: { canonical: "/" } };
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const isBare = Object.keys(params).length === 0;
  const session = await getSession();
  if (isBare && session) redirect(`/users/${session.user.id}`);
  const state = parseSearchState(params);
  state.area = await loadAreaSelection(state.filter.areaId);
  const initial = await loadSearch(state, session?.user.id ?? null);
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Search</h1>
      <AppSearch initialState={state} initial={initial} viewerId={session?.user.id ?? null} />
    </div>
  );
}

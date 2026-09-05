import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { JournalView } from "@/app/users/[id]/journal-view";
import { ProfileHeader, getUserById } from "@/app/users/[id]/profile-shell";
import { parseJournalFilter } from "@/lib/journal-filter";
import type { SearchParamsRecord } from "@/lib/search-params";
import { getSession } from "@/lib/session";
import { canViewJournal } from "@/lib/user-visibility";

type UserJournalPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParamsRecord>;
};

export async function generateMetadata({ params }: UserJournalPageProps): Promise<Metadata> {
  const { id } = await params;
  const [user, session] = await Promise.all([getUserById(id), getSession()]);
  if (!user || !canViewJournal(user, session?.user.id ?? null)) notFound();

  return { title: `${user.name} · Journal`, robots: { index: false } };
}

export default async function UserJournalPage({ params, searchParams }: UserJournalPageProps) {
  const [{ id }, search] = await Promise.all([params, searchParams]);
  const [user, session] = await Promise.all([getUserById(id), getSession()]);
  const viewerId = session?.user.id ?? null;

  if (!user || !canViewJournal(user, viewerId)) notFound();

  return (
    <div className="flex flex-col gap-6">
      <ProfileHeader user={user} viewerId={viewerId} />
      <JournalView owner={user} viewerId={viewerId} filter={parseJournalFilter(search)} />
    </div>
  );
}

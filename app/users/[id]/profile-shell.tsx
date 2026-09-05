import { cache } from "react";

import { LogEntryButton } from "@/components/journal";
import { ProfileTabs } from "@/components/profile-tabs";
import { Eyebrow } from "@/components/ui/eyebrow";
import { PageTitle } from "@/components/ui/typography";
import { getDb } from "@/db/client";
import { getUser } from "@/db/queries";
import { canViewJournal } from "@/lib/user-visibility";

export const getUserById = cache(async (id: string) => {
  const db = await getDb();
  return getUser(db, id);
});

type ProfileUser = {
  id: string;
  name: string;
  createdAt: Date;
  isPrivate: boolean;
  journalVisibility: "private" | "public";
};

export async function ProfileHeader({
  user,
  viewerId,
}: {
  user: ProfileUser;
  viewerId: string | null;
}) {
  const isOwner = viewerId === user.id;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <Eyebrow>Climber</Eyebrow>
          <PageTitle>{user.name}</PageTitle>
          <span className="mt-1 text-sm text-muted">
            Active since {new Date(user.createdAt).getFullYear()}
          </span>
        </div>
        {isOwner && (
          <div className="sm:shrink-0">
            <LogEntryButton />
          </div>
        )}
      </div>

      <ProfileTabs
        userId={user.id}
        showJournal={canViewJournal(user, viewerId)}
        showProjects={isOwner}
      />
    </div>
  );
}

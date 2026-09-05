import { cache } from "react";

import { LogEntryButton } from "@/components/journal";
import { ProfileHeading } from "@/components/profile-heading";
import { ProfileTabs } from "@/components/profile-tabs";
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
      <ProfileHeading
        name={user.name}
        since={new Date(user.createdAt).getFullYear()}
        action={isOwner ? <LogEntryButton /> : undefined}
      />

      <ProfileTabs
        userId={user.id}
        showJournal={canViewJournal(user, viewerId)}
        showProjects={isOwner}
      />
    </div>
  );
}

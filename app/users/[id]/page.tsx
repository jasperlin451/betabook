import { notFound } from "next/navigation";
import { SendList } from "@/components/send-list";
import { getSendsForUser, getUser } from "@/db/queries";
import { getDb } from "@/db/client";

type UserPageProps = {
  params: Promise<{ id: string }>;
};

export default async function UserPage({ params }: UserPageProps) {
  const { id } = await params;

  const db = await getDb();
  const user = await getUser(db, id);
  if (!user) notFound();

  const userSends = await getSendsForUser(db, id);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">{user.name}</h1>

      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Sends</h2>
        <SendList sends={userSends} context="user" />
      </div>
    </div>
  );
}

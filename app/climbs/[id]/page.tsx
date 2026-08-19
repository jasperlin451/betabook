import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { Link } from "@heroui/react";
import { AreaBreadcrumbs } from "@/components/breadcrumbs";
import { SendPanel } from "@/components/send-panel";
import { SendList } from "@/components/send-list";
import { getAncestors, getArea, getClimb, getSendsForClimb, getUserSendForClimb } from "@/db/queries";
import { formatGrade } from "@/lib/grades";
import { getDb } from "@/db/client";
import { initAuth } from "@/lib/auth";

type ClimbPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ClimbPage({ params }: ClimbPageProps) {
  const { id } = await params;
  const climbId = Number(id);

  if (!Number.isInteger(climbId)) notFound();

  const db = await getDb();
  const climb = await getClimb(db, climbId);

  if (!climb) notFound();

  const area = await getArea(db, climb.areaId);
  if (!area) notFound();

  const ancestors = await getAncestors(db, area);

  const auth = await initAuth();
  const session = await auth.api.getSession({ headers: await headers() });
  const userSend = session
    ? ((await getUserSendForClimb(db, session.user.id, climb.id)) ?? null)
    : null;
  const climbSends = await getSendsForClimb(db, climb.id);

  return (
    <div className="flex flex-col gap-6">
      <AreaBreadcrumbs ancestors={[...ancestors, area]} current={climb} />

      <div>
        <h1 className="text-2xl font-semibold">{climb.name}</h1>
        <p className="text-muted mt-1 capitalize">
          {climb.type} &middot; {formatGrade(climb.type, climb.grade)}
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Sends</h2>

        {session ? (
          <SendPanel climb={climb} existingSend={userSend} />
        ) : (
          <p className="text-muted text-sm">
            <Link href="/sign-in">Sign in</Link> to log a send.
          </p>
        )}

        <SendList sends={climbSends} context="climb" climbType={climb.type} />
      </div>
    </div>
  );
}

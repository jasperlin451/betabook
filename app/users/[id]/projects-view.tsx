import { OpenProjectList } from "@/components/journal";
import { SectionHeading } from "@/components/ui/typography";
import { getDb } from "@/db/client";
import { getOpenProjects, type JournalOwner } from "@/db/queries";
import { formatCount } from "@/lib/format";

export async function ProjectsView({ owner }: { owner: JournalOwner }) {
  const projects = await getOpenProjects(await getDb(), owner, owner.id);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <SectionHeading>Projects</SectionHeading>
        <span className="text-sm text-muted">{formatCount(projects.length, "open project")}</span>
      </div>
      <OpenProjectList projects={projects} />
    </div>
  );
}

import { NotFoundMessage } from "@/components/ui/not-found-message";

export default function ClimbNotFound() {
  return (
    <NotFoundMessage
      heading="Climb not found"
      message="We couldn't find a climb with that id. It may have been removed, or the link may be wrong."
    />
  );
}

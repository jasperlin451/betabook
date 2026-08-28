import { NotFoundMessage } from "@/components/ui/not-found-message";

export default function UserNotFound() {
  return (
    <NotFoundMessage
      heading="Climber not found"
      message="We couldn't find a climber with that id. They may have left, or the link may be wrong."
    />
  );
}

import { NotFoundMessage } from "@/components/ui/not-found-message";

export default function AreaNotFound() {
  return (
    <NotFoundMessage
      heading="Area not found"
      message="We couldn't find an area with that id."
    />
  );
}

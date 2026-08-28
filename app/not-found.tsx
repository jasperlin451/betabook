import type { Metadata } from "next";
import { NotFoundMessage } from "@/components/ui/not-found-message";

export const metadata: Metadata = {
  title: "Page not found",
};

export default function NotFound() {
  return (
    <NotFoundMessage
      heading="Page not found"
      message="Try searching for an area or climb from the home page."
    />
  );
}

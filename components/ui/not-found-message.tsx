import type { ReactNode } from "react";

type NotFoundMessageProps = {
  heading: string;
  message: ReactNode;
};

export function NotFoundMessage({ heading, message }: NotFoundMessageProps) {
  return (
    <div className="flex flex-col gap-2">
      {/* Deliberately the sans/utility h1 treatment, not the condensed
        * display face used on entity pages: "not found" is a system message
        * like the auth and account screens, and the guidebook voice is
        * reserved for guidebook content (areas, climbs, climbers). */}
      <h1 className="text-2xl font-semibold">{heading}</h1>
      <p className="text-muted">{message}</p>
    </div>
  );
}

import type { ReactNode } from "react";

type NotFoundMessageProps = {
  heading: string;
  message: ReactNode;
};

export function NotFoundMessage({ heading, message }: NotFoundMessageProps) {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold">{heading}</h1>
      <p className="text-muted">{message}</p>
    </div>
  );
}

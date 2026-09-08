import { getSession } from "@/lib/session";

type Session = NonNullable<Awaited<ReturnType<typeof getSession>>>;

/** Authenticate before parsing input or looking up records, including suggestions. */
export function withApiSession<Args extends unknown[]>(
  handler: (session: Session, ...args: Args) => Promise<Response>,
): (...args: Args) => Promise<Response> {
  return async (...args) => {
    let response: Response;
    try {
      const session = await getSession();
      response = session
        ? await handler(session, ...args)
        : Response.json({ error: "Not signed in" }, { status: 401 });
    } catch (error) {
      console.error("Application data request failed", error);
      response = Response.json({ error: "Internal server error" }, { status: 500 });
    }
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  };
}

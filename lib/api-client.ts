export const AUTH_REQUIRED_EVENT = "betabook:auth-required";

export class AuthenticationRequiredError extends Error {
  public constructor() {
    super("Not signed in");
    this.name = "AuthenticationRequiredError";
  }
}

/** A 401 invalidates displayed member data as well as the request that failed. */
export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const response = await fetch(input, { ...init, cache: "no-store" });
  if (response.status === 401) {
    if (!init?.signal?.aborted && typeof window !== "undefined")
      window.dispatchEvent(new Event(AUTH_REQUIRED_EVENT));
    throw new AuthenticationRequiredError();
  }
  return response;
}

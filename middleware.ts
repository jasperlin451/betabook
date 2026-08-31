import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { signInUrl } from "@/lib/sign-in-redirect";

// Deliberately kept as the deprecated `middleware.ts` convention instead of
// Next 16's `proxy.ts`: proxy files always run on the Node.js runtime with no
// way to opt out, but @opennextjs/cloudflare's build only supports edge
// middleware — a `proxy.ts` here fails the Cloudflare build. `middleware.ts`
// still accepts `runtime: "edge"` below.
export function middleware(request: NextRequest) {
  if (!getSessionCookie(request)) {
    const { pathname, search } = request.nextUrl;
    return NextResponse.redirect(
      new URL(signInUrl(pathname + search), request.url),
    );
  }
}

export const config = {
  runtime: "experimental-edge",
  matcher: ["/account", "/account/import"],
};

import type { NextRequest } from "next/server";
import { logMessage } from "~/server/serverUtilityFunctions";

export function proxy(request: NextRequest) {
  const url = new URL(request.url);

  logMessage("RR0001", `Page visit: ${url.pathname}${url.search}`, {
    metadata: { pathname: url.pathname, queryString: url.search },
  });
}

export const config = {
  matcher: [
    "/",
    "/competitions",
    "/competitions/(.*)",
    "/rankings/(.*)",
    "/records/(.*)",
    "/rules",
    "/rules/(.*)",
    "/about",
    "/donate",
    "/donate/(.*)",
    "/moderator-instructions/(.*)",
    "/user/submit-results",
  ],
};

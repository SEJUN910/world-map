import type { Instrumentation } from "next";

// No process.on("uncaughtException"/"unhandledRejection") handlers: even a
// log-only handler stops Node from exiting, leaving a corrupted process serving
// requests. Next's onRequestError hook covers server errors per request instead.
export const onRequestError: Instrumentation.onRequestError = (error, request, context) => {
  const digest = typeof error === "object" && error !== null && "digest" in error ? String((error as { digest?: unknown }).digest) : undefined;
  console.error("[onRequestError]", {
    // Query strings can carry tokens; log the path only and never the headers.
    path: request.path.split("?")[0],
    method: request.method,
    routePath: context.routePath,
    routeType: context.routeType,
    digest,
    error: error instanceof Error ? { name: error.name, message: error.message.slice(0, 500), stack: error.stack } : String(error).slice(0, 500),
  });
};

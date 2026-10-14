import { createFileRoute } from "@tanstack/react-router";
import { contentHandlers } from "@/lib/content-server";

export const Route = createFileRoute("/api/content")({
  server: {
    handlers: {
      GET: ({ request }) => contentHandlers.GET(request),
      POST: ({ request }) => contentHandlers.POST(request),
      PATCH: ({ request }) => contentHandlers.PATCH(request),
      DELETE: ({ request }) => contentHandlers.DELETE(request),
    },
  },
});

export default Route;

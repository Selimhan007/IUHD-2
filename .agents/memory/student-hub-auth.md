---
name: Student Hub auth routing
description: Preserve the Replit preview origin and route precedence required by the imported Better Auth endpoints.
---

Student Hub serves auth, profile, and assistant routes inside its web service under `/api/*`, while the workspace also has a shared `/api` service. Keep the app's API paths more specific in artifact routing so the shared service does not capture them.

Better Auth must trust the current Replit development origin as well as the explicit local preview origin. Do not replace this with a wildcard that trusts arbitrary hosts.

**Why:** The imported login flow was blocked both by missing demo accounts and by an untrusted preview origin.

**How to apply:** Preserve the specific API route prefixes and Replit-origin handling when changing artifact routing or Better Auth configuration.

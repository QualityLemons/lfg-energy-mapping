# LFG Energy Mapping

An open-source tool for viewing and contributing energy infrastructure data on OpenStreetMap — power lines, substations, solar farms, wind turbines, and more.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port assigned by workflow)
- `pnpm --filter @workspace/lfg-energy-mapping run dev` — run the frontend (port assigned by workflow)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, react-leaflet (Leaflet.js maps), TanStack Query, Tailwind CSS, shadcn/ui
- API: Express 5 (proxy to Overpass API and OSM API v0.6)
- Validation: Zod (`zod/v4`)
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- No database — reads from OpenStreetMap's Overpass API; writes via OSM API v0.6

## Where things live

- `lib/api-spec/openapi.yaml` — API contract (source of truth)
- `lib/api-client-react/src/generated/` — generated React Query hooks
- `lib/api-zod/src/generated/` — generated Zod schemas for server validation
- `artifacts/api-server/src/routes/` — Express route handlers
  - `energy.ts` — Overpass API proxy for reading energy features
  - `auth.ts` — OSM OAuth 2.0 PKCE authentication flow
  - `changesets.ts` — OSM changeset management for writing edits
- `artifacts/lfg-energy-mapping/src/` — React frontend

## Architecture decisions

- No database: all map data is read live from Overpass API / OSM API v0.6. The backend is purely a proxy (handles CORS, OAuth, and request transformation).
- OSM OAuth 2.0 PKCE: Reading is public/unauthenticated (Overpass API). Editing requires OSM OAuth 2.0 with PKCE. Sessions stored in express-session (memory store, dev-only).
- Overpass API for reads: More flexible than OSM API v0.6 for complex spatial queries.
- Codegen-first: All API types flow from `openapi.yaml` → generated Zod schemas (server) + React Query hooks (client).

## Product

- View energy infrastructure on an interactive map (power lines, substations, generators, solar, wind, nuclear, hydro)
- Filter by energy type, click features for full OSM tag details
- Authenticate with your OSM account to contribute edits
- Create changesets, update feature tags, and submit to OSM directly
- Stats dashboard showing global energy infrastructure breakdowns
- Recent edits feed showing community contributions

## User preferences

- Open-source project: https://github.com/QualityLemons/lfg-energy-mapping
- GitHub integration connected for push/pull

## Gotchas

- Editing requires `OSM_CLIENT_ID` and `OSM_CLIENT_SECRET` env vars (register app at https://www.openstreetmap.org/user/settings/oauth2). Reading works without these.
- `SESSION_SECRET` env var is already configured.
- `SESSION_SECRET` is required for session signing in production.
- Overpass API has rate limits and timeouts — stats queries run parallel count queries and may be slow.
- Leaflet default icon fix: must delete `L.Icon.Default.prototype._getIconUrl` and set icon URLs manually in the component.
- After any `openapi.yaml` change: run `pnpm --filter @workspace/api-spec run codegen` before using updated types.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- OSM API v0.6 docs: https://wiki.openstreetmap.org/wiki/API_v0.6
- Overpass API docs: https://wiki.openstreetmap.org/wiki/Overpass_API

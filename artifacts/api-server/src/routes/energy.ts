import { Router, type IRouter, type Request, type Response } from "express";
import {
  GetEnergyFeaturesQueryParams,
  GetEnergyFeatureParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

const OVERPASS_API = "https://overpass-api.de/api/interpreter";
const OSM_API = "https://api.openstreetmap.org/api/0.6";

interface OverpassElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  tags?: Record<string, string>;
  geometry?: Array<{ lat: number; lon: number }>;
  version?: number;
  timestamp?: string;
}

function transformElement(el: OverpassElement) {
  let lat: number | null = el.lat ?? null;
  let lon: number | null = el.lon ?? null;
  let geometry: { type: string; coordinates: unknown[] } | null = null;

  if (el.type === "way" && el.geometry && el.geometry.length > 0) {
    const coords = el.geometry.map((g) => [g.lon, g.lat]);
    geometry = { type: "LineString", coordinates: coords };
    if (!lat) {
      lat =
        el.geometry.reduce((s, g) => s + g.lat, 0) / el.geometry.length;
      lon =
        el.geometry.reduce((s, g) => s + g.lon, 0) / el.geometry.length;
    }
  }

  const tags = el.tags ?? {};
  return {
    id: `${el.type}/${el.id}`,
    osmType: el.type,
    osmId: String(el.id),
    lat,
    lon,
    geometry,
    tags,
    powerType: tags.power ?? null,
    generatorSource: tags["generator:source"] ?? null,
    name: tags.name ?? null,
    version: el.version ?? null,
    lastEdited: el.timestamp ?? null,
  };
}

// GET /api/energy/features
router.get("/energy/features", async (req: Request, res: Response) => {
  const parsed = GetEnergyFeaturesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid bounding box parameters" });
    return;
  }

  const { south, west, north, east, types } = parsed.data;

  const typeFilter = types
    ? types.split(",").map((t) => t.trim()).filter(Boolean)
    : null;

  const bbox = `${south},${west},${north},${east}`;

  let nodeQueries = `node["power"](${bbox});`;
  let wayQueries = `way["power"](${bbox});`;
  let relQueries = `relation["power"](${bbox});`;

  if (typeFilter && typeFilter.length > 0) {
    const vals = typeFilter.map((t) => `"${t}"`).join("|");
    nodeQueries = `node["power"~${vals}](${bbox});`;
    wayQueries = `way["power"~${vals}](${bbox});`;
    relQueries = `relation["power"~${vals}](${bbox});`;
  }

  const query = `[out:json][timeout:25];(${nodeQueries}${wayQueries}${relQueries});out body geom;`;

  try {
    const response = await fetch(OVERPASS_API, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `data=${encodeURIComponent(query)}`,
    });

    if (!response.ok) {
      req.log.error({ status: response.status }, "Overpass API error");
      res.status(502).json({ error: "Upstream Overpass API error" });
      return;
    }

    const data = (await response.json()) as { elements: OverpassElement[] };
    const features = (data.elements ?? [])
      .filter((el) => el.tags?.power)
      .map(transformElement);

    res.json(features);
  } catch (err) {
    req.log.error({ err }, "Failed to query Overpass API");
    res.status(502).json({ error: "Failed to reach Overpass API" });
  }
});

// GET /api/energy/feature/:osmType/:osmId
router.get(
  "/energy/feature/:osmType/:osmId",
  async (req: Request, res: Response) => {
    const parsed = GetEnergyFeatureParams.safeParse(req.params);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid parameters" });
      return;
    }

    const { osmType, osmId } = parsed.data;

    try {
      const url = `${OSM_API}/${osmType}/${osmId}.json`;
      const response = await fetch(url);

      if (response.status === 404) {
        res.status(404).json({ error: "Feature not found" });
        return;
      }

      if (!response.ok) {
        res.status(502).json({ error: "OSM API error" });
        return;
      }

      const data = (await response.json()) as {
        elements?: OverpassElement[];
      };
      const el = data.elements?.[0];
      if (!el) {
        res.status(404).json({ error: "Feature not found" });
        return;
      }

      res.json(transformElement(el));
    } catch (err) {
      req.log.error({ err }, "Failed to fetch OSM feature");
      res.status(502).json({ error: "Failed to reach OSM API" });
    }
  },
);

// GET /api/energy/stats
router.get("/energy/stats", async (req: Request, res: Response) => {
  const query = `[out:json][timeout:60];
(
  way["power"="line"];
  way["power"="cable"];
);out count;`;

  const powerTypes = [
    { key: "line", label: "Transmission Lines" },
    { key: "substation", label: "Substations" },
    { key: "generator", label: "Generators" },
    { key: "tower", label: "Towers" },
    { key: "plant", label: "Power Plants" },
    { key: "cable", label: "Cables" },
  ];

  const generatorSources = [
    { key: "solar", label: "Solar" },
    { key: "wind", label: "Wind" },
    { key: "hydro", label: "Hydro" },
    { key: "gas", label: "Natural Gas" },
    { key: "nuclear", label: "Nuclear" },
    { key: "coal", label: "Coal" },
    { key: "oil", label: "Oil" },
  ];

  try {
    // Use count queries for individual power types
    const typeCountQueries = powerTypes.map(({ key }) => {
      const q = `[out:json][timeout:30];nwr["power"="${key}"];out count;`;
      return fetch(OVERPASS_API, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `data=${encodeURIComponent(q)}`,
        signal: AbortSignal.timeout(35000),
      })
        .then((r) => r.json())
        .then((d: unknown) => {
          const data = d as { elements?: Array<{ tags?: Record<string, string> }> };
          const tags = data.elements?.[0]?.tags ?? {};
          return Number(tags.total ?? 0);
        })
        .catch(() => 0);
    });

    const counts = await Promise.all(typeCountQueries);
    const total = counts.reduce((s, c) => s + c, 0);

    const byType = powerTypes.map(({ key, label }, i) => ({
      type: key,
      count: counts[i],
      label,
    }));

    // Generator source breakdown
    const genSourceQueries = generatorSources.map(({ key }) => {
      const q = `[out:json][timeout:30];nwr["power"="generator"]["generator:source"="${key}"];out count;`;
      return fetch(OVERPASS_API, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `data=${encodeURIComponent(q)}`,
        signal: AbortSignal.timeout(35000),
      })
        .then((r) => r.json())
        .then((d: unknown) => {
          const data = d as { elements?: Array<{ tags?: Record<string, string> }> };
          const tags = data.elements?.[0]?.tags ?? {};
          return Number(tags.total ?? 0);
        })
        .catch(() => 0);
    });

    const sourceCounts = await Promise.all(genSourceQueries);
    const byGeneratorSource = generatorSources.map(({ key, label }, i) => ({
      type: key,
      count: sourceCounts[i],
      label,
    }));

    res.json({ totalFeatures: total, byType, byGeneratorSource });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch energy stats");
    res.status(502).json({ error: "Failed to fetch stats" });
  }
});

// GET /api/energy/recent-edits
router.get("/energy/recent-edits", async (req: Request, res: Response) => {
  const limit = Math.min(Number(req.query.limit ?? 10), 50);

  try {
    // Query recent changesets that have power-related comments
    const url = `${OSM_API}/changesets.json?only_open=false&limit=${limit * 3}`;
    const response = await fetch(url);

    if (!response.ok) {
      res.status(502).json({ error: "OSM API error" });
      return;
    }

    const data = (await response.json()) as {
      changesets?: Array<{
        id: number;
        uid: number;
        user: string;
        created_at: string;
        tags?: Record<string, string>;
        min_lat?: number;
        min_lon?: number;
        max_lat?: number;
        max_lon?: number;
        changes_count?: number;
      }>;
    };

    const changesets = (data.changesets ?? [])
      .filter((c) => {
        const comment = (c.tags?.comment ?? "").toLowerCase();
        const src = (c.tags?.source ?? "").toLowerCase();
        return (
          comment.includes("power") ||
          comment.includes("energy") ||
          comment.includes("solar") ||
          comment.includes("wind") ||
          comment.includes("substation") ||
          comment.includes("generator") ||
          src.includes("power") ||
          src.includes("energy")
        );
      })
      .slice(0, limit)
      .map((c) => ({
        changesetId: String(c.id),
        userId: String(c.uid),
        username: c.user,
        createdAt: c.created_at,
        comment: c.tags?.comment ?? "(no comment)",
        featuresEdited: c.changes_count ?? null,
        bbox:
          c.min_lat != null
            ? {
                south: c.min_lat,
                west: c.min_lon,
                north: c.max_lat,
                east: c.max_lon,
              }
            : null,
      }));

    res.json(changesets);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch recent edits");
    res.status(502).json({ error: "Failed to fetch recent edits" });
  }
});

export default router;

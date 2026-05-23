import { Router, type IRouter, type Request, type Response } from "express";
import { inflateRawSync } from "node:zlib";
import {
  GetEnergyFeaturesQueryParams,
  GetEnergyFeatureParams,
  GetFlexibilityByPostcodeParams,
  GetIndustrialAreasQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

const OVERPASS_APIS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];
const OVERPASS_API = OVERPASS_APIS[0];
const OSM_API = "https://api.openstreetmap.org/api/0.6";
const NGED_FLEXIBILITY_SOURCE =
  "https://connecteddata.nationalgrid.co.uk/dataset/flexibility-forecasts";
const NGED_POSTCODES_ZIP =
  "https://connecteddata.nationalgrid.co.uk/dataset/88339641-9e55-4406-b388-f91c711ecad3/resource/a9a0ddbf-117c-4b20-82cc-a3689d2422c9/download/where_all_postcodes.zip";
const OVERPASS_HEADERS = {
  "Content-Type": "application/x-www-form-urlencoded",
  "User-Agent": "lfg-energy-mapping/0.0.0 (local development)",
};

interface OverpassElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  tags?: Record<string, string>;
  geometry?: Array<{ lat: number; lon: number }>;
  center?: { lat: number; lon: number };
  version?: number;
  timestamp?: string;
}

interface OsmMapElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  nodes?: number[];
  tags?: Record<string, string>;
}

interface GeoGeometry {
  type: string;
  coordinates: unknown[];
}

interface FlexibilityZone {
  level: "HV" | "LV";
  code: string;
  name: string;
  licenceArea: string | null;
  product: string | null;
  substationName: string | null;
  substationNumber: string | null;
}

function transformElement(el: OverpassElement) {
  let lat: number | null = el.lat ?? null;
  let lon: number | null = el.lon ?? null;
  let geometry: GeoGeometry | null = null;

  if (el.type === "way" && el.geometry && el.geometry.length > 0) {
    const coords = el.geometry.map((g) => [g.lon, g.lat]);
    geometry = { type: "LineString", coordinates: coords };
    if (lat == null || lon == null) {
      lat = el.geometry.reduce((s, g) => s + g.lat, 0) / el.geometry.length;
      lon = el.geometry.reduce((s, g) => s + g.lon, 0) / el.geometry.length;
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

function transformIndustrialElement(el: OverpassElement) {
  const tags = el.tags ?? {};
  let lat: number | null = el.lat ?? el.center?.lat ?? null;
  let lon: number | null = el.lon ?? el.center?.lon ?? null;
  let geometry: GeoGeometry | null = null;

  if (el.geometry && el.geometry.length > 0) {
    const coords = el.geometry.map((g) => [g.lon, g.lat]);
    const first = coords[0];
    const last = coords[coords.length - 1];
    const isClosed =
      coords.length > 3 && first[0] === last[0] && first[1] === last[1];

    geometry = isClosed
      ? { type: "Polygon", coordinates: [coords] }
      : { type: "LineString", coordinates: coords };

    if (lat == null || lon == null) {
      lat = el.geometry.reduce((s, g) => s + g.lat, 0) / el.geometry.length;
      lon = el.geometry.reduce((s, g) => s + g.lon, 0) / el.geometry.length;
    }
  }

  return {
    id: `${el.type}/${el.id}`,
    osmType: el.type,
    osmId: String(el.id),
    lat,
    lon,
    geometry,
    tags,
    name: tags.name ?? null,
    landuse: tags.landuse ?? null,
    industrial: tags.industrial ?? null,
  };
}

type IndustrialAreaFeature = ReturnType<typeof transformIndustrialElement>;

const INDUSTRIAL_AREA_CACHE_MS = 15 * 60 * 1000;
const industrialAreaCache = new Map<
  string,
  { expiresAt: number; features: IndustrialAreaFeature[] }
>();
const industrialAreaRequests = new Map<string, Promise<IndustrialAreaFeature[]>>();

function isIndustrialTags(tags: Record<string, string> | undefined): boolean {
  if (!tags) return false;
  return (
    tags.landuse === "industrial" ||
    Boolean(tags.industrial) ||
    /Industrial Estate|Trading Estate|Business Park|Enterprise Park/i.test(
      tags.name ?? "",
    )
  );
}

async function queryIndustrialAreasFromOsmMap(
  south: number,
  west: number,
  north: number,
  east: number,
): Promise<IndustrialAreaFeature[]> {
  const url = `${OSM_API}/map.json?bbox=${west},${south},${east},${north}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(20000) });

  if (!response.ok) {
    throw new Error(`OSM map API failed with ${response.status}`);
  }

  const text = await response.text();
  if (!text.trim().startsWith("{")) {
    throw new Error(text.trim().slice(0, 120) || "OSM map API did not return JSON");
  }

  const data = JSON.parse(text) as { elements?: OsmMapElement[] };
  const nodes = new Map<number, { lat: number; lon: number }>();
  for (const el of data.elements ?? []) {
    if (el.type === "node" && el.lat != null && el.lon != null) {
      nodes.set(el.id, { lat: el.lat, lon: el.lon });
    }
  }

  return (data.elements ?? [])
    .filter((el) => el.type === "way" && isIndustrialTags(el.tags))
    .map((el) => {
      const geometry = (el.nodes ?? [])
        .map((nodeId) => nodes.get(nodeId))
        .filter((node): node is { lat: number; lon: number } => Boolean(node));

      return transformIndustrialElement({
        type: "way",
        id: el.id,
        tags: el.tags,
        geometry,
      });
    })
    .filter((feature) => feature.geometry);
}

function industrialAreaCacheKey(
  south: number,
  west: number,
  north: number,
  east: number,
): string {
  return [south, west, north, east].map((value) => value.toFixed(5)).join(",");
}

async function fetchIndustrialAreas(
  south: number,
  west: number,
  north: number,
  east: number,
  log: Request["log"],
): Promise<IndustrialAreaFeature[]> {
  const bbox = `${south},${west},${north},${east}`;
  const query = `[out:json][timeout:25];
(
  way["landuse"="industrial"](${bbox});
  relation["landuse"="industrial"](${bbox});
  way["industrial"](${bbox});
  relation["industrial"](${bbox});
  way["name"~"Industrial Estate|Trading Estate|Business Park|Enterprise Park",i](${bbox});
  relation["name"~"Industrial Estate|Trading Estate|Business Park|Enterprise Park",i](${bbox});
);
out body center geom;`;

  try {
    let lastError: unknown = null;

    for (const endpoint of OVERPASS_APIS) {
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: OVERPASS_HEADERS,
          body: `data=${encodeURIComponent(query)}`,
          signal: AbortSignal.timeout(20000),
        });

        if (!response.ok) {
          throw new Error(`Overpass API failed with ${response.status}`);
        }

        const data = (await response.json()) as { elements: OverpassElement[] };
        return Array.from(
          new Map(
            (data.elements ?? [])
              .filter((el) => isIndustrialTags(el.tags))
              .map((el) => {
                const feature = transformIndustrialElement(el);
                return [feature.id, feature] as const;
              }),
          ).values(),
        );
      } catch (err) {
        lastError = err;
        log.warn({ err, endpoint }, "Overpass endpoint failed");
      }
    }

    throw lastError ?? new Error("All Overpass endpoints failed");
  } catch (err) {
    log.warn({ err }, "Falling back to OSM map API for industrial areas");
    return queryIndustrialAreasFromOsmMap(south, west, north, east);
  }
}

function normalisePostcode(postcode: string): string {
  return postcode.toUpperCase().replace(/\s+/g, "");
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  values.push(current);
  return values;
}

function extractFirstCsvFromZip(data: ArrayBuffer): Buffer {
  const buffer = Buffer.from(data);
  const eocdSignature = 0x06054b50;
  let eocdOffset = -1;

  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i -= 1) {
    if (buffer.readUInt32LE(i) === eocdSignature) {
      eocdOffset = i;
      break;
    }
  }

  if (eocdOffset === -1) {
    throw new Error("Could not find ZIP directory");
  }

  const entryCount = buffer.readUInt16LE(eocdOffset + 10);
  let centralOffset = buffer.readUInt32LE(eocdOffset + 16);

  for (let i = 0; i < entryCount; i += 1) {
    if (buffer.readUInt32LE(centralOffset) !== 0x02014b50) {
      throw new Error("Invalid ZIP central directory");
    }

    const compressionMethod = buffer.readUInt16LE(centralOffset + 10);
    const compressedSize = buffer.readUInt32LE(centralOffset + 20);
    const fileNameLength = buffer.readUInt16LE(centralOffset + 28);
    const extraLength = buffer.readUInt16LE(centralOffset + 30);
    const commentLength = buffer.readUInt16LE(centralOffset + 32);
    const localHeaderOffset = buffer.readUInt32LE(centralOffset + 42);
    const fileName = buffer
      .subarray(centralOffset + 46, centralOffset + 46 + fileNameLength)
      .toString("utf8");

    if (fileName.toLowerCase().endsWith(".csv")) {
      const localFileNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
      const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28);
      const compressedStart =
        localHeaderOffset + 30 + localFileNameLength + localExtraLength;
      const compressed = buffer.subarray(
        compressedStart,
        compressedStart + compressedSize,
      );

      if (compressionMethod === 0) return compressed;
      if (compressionMethod === 8) return inflateRawSync(compressed);
      throw new Error(`Unsupported ZIP compression method ${compressionMethod}`);
    }

    centralOffset += 46 + fileNameLength + extraLength + commentLength;
  }

  throw new Error("ZIP did not contain a CSV file");
}

function rowValue(row: Record<string, string>, key: string): string {
  return row[key]?.trim() ?? "";
}

function addZone(
  zones: FlexibilityZone[],
  seen: Set<string>,
  zone: FlexibilityZone,
) {
  const key = `${zone.level}:${zone.code}`;
  if (!zone.code || seen.has(key)) return;
  seen.add(key);
  zones.push(zone);
}

let flexibilityIndexPromise: Promise<Map<string, FlexibilityZone[]>> | null = null;

async function getFlexibilityPostcodeIndex(): Promise<Map<string, FlexibilityZone[]>> {
  if (flexibilityIndexPromise) return flexibilityIndexPromise;

  flexibilityIndexPromise = (async () => {
    const response = await fetch(NGED_POSTCODES_ZIP, {
      signal: AbortSignal.timeout(60000),
    });

    if (!response.ok) {
      throw new Error(`NGED postcode download failed with ${response.status}`);
    }

    const csv = extractFirstCsvFromZip(await response.arrayBuffer())
      .toString("utf8")
      .replace(/^\uFEFF/, "");
    const lines = csv.split(/\r?\n/).filter(Boolean);
    const headers = parseCsvLine(lines[0]);
    const index = new Map<string, FlexibilityZone[]>();
    const seenByPostcode = new Map<string, Set<string>>();

    for (const line of lines.slice(1)) {
      const values = parseCsvLine(line);
      const row = Object.fromEntries(
        headers.map((header, i) => [header, values[i] ?? ""]),
      );
      const postcode = normalisePostcode(rowValue(row, "Postcode"));
      if (!postcode) continue;

      const zones = index.get(postcode) ?? [];
      const seen = seenByPostcode.get(postcode) ?? new Set<string>();

      addZone(zones, seen, {
        level: "HV",
        code: rowValue(row, "HV CMZ Code"),
        name: rowValue(row, "HV Zone Name"),
        licenceArea: rowValue(row, "HV Zone Licence Area") || null,
        product:
          rowValue(row, "HV Zone Flexibility Product") ||
          rowValue(row, "HV Zonne Flexibility Product") ||
          null,
        substationName: rowValue(row, "Primary Substation Name") || null,
        substationNumber: rowValue(row, "Primary Substation Number") || null,
      });

      addZone(zones, seen, {
        level: "LV",
        code: rowValue(row, "LV CMZ Code"),
        name: rowValue(row, "LV Zone Name"),
        licenceArea: rowValue(row, "LV Zone Licence Area") || null,
        product: rowValue(row, "LV Zone Flexibility Product") || null,
        substationName: rowValue(row, "Secondary Substation Name") || null,
        substationNumber: rowValue(row, "Secondary Substation Number") || null,
      });

      if (zones.length > 0) {
        index.set(postcode, zones);
        seenByPostcode.set(postcode, seen);
      }
    }

    return index;
  })().catch((err) => {
    flexibilityIndexPromise = null;
    throw err;
  });

  return flexibilityIndexPromise;
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
    ? types
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
    : null;

  const bbox = `${south},${west},${north},${east}`;

  let nodeQueries = `node["power"](${bbox});`;
  let wayQueries = `way["power"](${bbox});`;
  let relQueries = `relation["power"](${bbox});`;

  if (typeFilter && typeFilter.length > 0) {
    const vals = typeFilter
      .map((t) => t.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&"))
      .join("|");
    nodeQueries = `node["power"~"${vals}"](${bbox});`;
    wayQueries = `way["power"~"${vals}"](${bbox});`;
    relQueries = `relation["power"~"${vals}"](${bbox});`;
  }

  const query = `[out:json][timeout:25];(${nodeQueries}${wayQueries}${relQueries});out body geom;`;

  try {
    const response = await fetch(OVERPASS_API, {
      method: "POST",
      headers: OVERPASS_HEADERS,
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

// GET /api/energy/industrial-areas
router.get("/energy/industrial-areas", async (req: Request, res: Response) => {
  res.setHeader("Cache-Control", "no-store");

  const parsed = GetIndustrialAreasQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid bounding box parameters" });
    return;
  }

  const { south, west, north, east } = parsed.data;
  const cacheKey = industrialAreaCacheKey(south, west, north, east);
  const cached = industrialAreaCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    res.json(cached.features);
    return;
  }

  try {
    let request = industrialAreaRequests.get(cacheKey);
    if (!request) {
      request = fetchIndustrialAreas(south, west, north, east, req.log);
      industrialAreaRequests.set(cacheKey, request);
    }

    const features = await request;
    industrialAreaCache.set(cacheKey, {
      expiresAt: Date.now() + INDUSTRIAL_AREA_CACHE_MS,
      features,
    });
    res.json(features);
  } catch (err) {
    if (cached) {
      req.log.warn({ err }, "Serving stale cached industrial areas");
      res.json(cached.features);
      return;
    }

    req.log.error({ err }, "Failed to query industrial areas");
    res.status(502).json({ error: "Failed to reach OSM industrial area data" });
  } finally {
    industrialAreaRequests.delete(cacheKey);
  }
});

// GET /api/energy/flexibility/postcode/:postcode
router.get(
  "/energy/flexibility/postcode/:postcode",
  async (req: Request, res: Response) => {
    res.setHeader("Cache-Control", "no-store");

    const parsed = GetFlexibilityByPostcodeParams.safeParse(req.params);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid postcode" });
      return;
    }

    const postcode = normalisePostcode(parsed.data.postcode);
    if (!postcode) {
      res.status(400).json({ error: "Invalid postcode" });
      return;
    }

    try {
      const index = await getFlexibilityPostcodeIndex();
      const zones = index.get(postcode) ?? [];

      res.json({
        postcode,
        source: "National Grid Electricity Distribution Flexibility Forecasts",
        sourceUrl: NGED_FLEXIBILITY_SOURCE,
        zones,
        note: "NGED says postcode and polygon mappings are indicative and final asset-to-zone mapping happens during market registration.",
      });
    } catch (err) {
      req.log.error({ err }, "Failed to query NGED flexibility data");
      res.status(502).json({ error: "Failed to fetch NGED flexibility data" });
    }
  },
);

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
        headers: OVERPASS_HEADERS,
        body: `data=${encodeURIComponent(q)}`,
        signal: AbortSignal.timeout(35000),
      })
        .then((r) => r.json())
        .then((d: unknown) => {
          const data = d as {
            elements?: Array<{ tags?: Record<string, string> }>;
          };
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
        headers: OVERPASS_HEADERS,
        body: `data=${encodeURIComponent(q)}`,
        signal: AbortSignal.timeout(35000),
      })
        .then((r) => r.json())
        .then((d: unknown) => {
          const data = d as {
            elements?: Array<{ tags?: Record<string, string> }>;
          };
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

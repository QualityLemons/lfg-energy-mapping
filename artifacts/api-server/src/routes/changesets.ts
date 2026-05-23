import { Router, type IRouter, type Request, type Response } from "express";
import { CreateChangesetBody, UpdateFeatureTagsBody, CloseChangesetParams, UpdateFeatureTagsParams } from "@workspace/api-zod";

const router: IRouter = Router();
const OSM_API = "https://api.openstreetmap.org/api/0.6";

function requireAuth(req: Request, res: Response): string | null {
  const token = req.session.osmAccessToken;
  if (!token) {
    res.status(401).json({ error: "Not authenticated. Sign in with OpenStreetMap to contribute." });
    return null;
  }
  return token;
}

// POST /api/changesets
router.post("/changesets", async (req: Request, res: Response) => {
  const token = requireAuth(req, res);
  if (!token) return;

  const parsed = CreateChangesetBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { comment, source } = parsed.data;

  const changesetXml = `<?xml version="1.0" encoding="UTF-8"?>
<osm version="0.6">
  <changeset>
    <tag k="created_by" v="LFG Energy Mapping"/>
    <tag k="comment" v="${escapeXml(comment)}"/>
    <tag k="source" v="${escapeXml(source ?? "survey")}"/>
  </changeset>
</osm>`;

  try {
    const response = await fetch(`${OSM_API}/changeset/create`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "text/xml",
      },
      body: changesetXml,
    });

    if (response.status === 401) {
      res.status(401).json({ error: "OSM authentication expired. Please sign in again." });
      return;
    }

    if (!response.ok) {
      const body = await response.text();
      req.log.error({ status: response.status, body }, "OSM changeset create failed");
      res.status(502).json({ error: "Failed to create changeset" });
      return;
    }

    const changesetId = await response.text();
    res.status(201).json({
      id: changesetId.trim(),
      comment,
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to create changeset");
    res.status(502).json({ error: "Failed to reach OSM API" });
  }
});

// PUT /api/changesets/:changesetId/close
router.put("/changesets/:changesetId/close", async (req: Request, res: Response) => {
  const token = requireAuth(req, res);
  if (!token) return;

  const parsed = CloseChangesetParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid changeset ID" });
    return;
  }

  const { changesetId } = parsed.data;

  try {
    const response = await fetch(`${OSM_API}/changeset/${changesetId}/close`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.status === 401) {
      res.status(401).json({ error: "OSM authentication expired" });
      return;
    }

    if (!response.ok) {
      res.status(502).json({ error: "Failed to close changeset" });
      return;
    }

    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to close changeset");
    res.status(502).json({ error: "Failed to reach OSM API" });
  }
});

// PATCH /api/features/:osmType/:osmId/tags
router.patch("/features/:osmType/:osmId/tags", async (req: Request, res: Response) => {
  const token = requireAuth(req, res);
  if (!token) return;

  const paramsResult = UpdateFeatureTagsParams.safeParse(req.params);
  if (!paramsResult.success) {
    res.status(400).json({ error: "Invalid parameters" });
    return;
  }

  const bodyResult = UpdateFeatureTagsBody.safeParse(req.body);
  if (!bodyResult.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { osmType, osmId } = paramsResult.data;
  const { changesetId, tags } = bodyResult.data;

  try {
    // First, fetch the current element
    const fetchUrl = `${OSM_API}/${osmType}/${osmId}.json`;
    const fetchRes = await fetch(fetchUrl);

    if (fetchRes.status === 404) {
      res.status(404).json({ error: "Feature not found" });
      return;
    }

    if (!fetchRes.ok) {
      res.status(502).json({ error: "Failed to fetch current element" });
      return;
    }

    const fetchData = (await fetchRes.json()) as {
      elements?: Array<{
        type: string;
        id: number;
        version: number;
        lat?: number;
        lon?: number;
        nodes?: number[];
        tags?: Record<string, string>;
      }>;
    };

    const element = fetchData.elements?.[0];
    if (!element) {
      res.status(404).json({ error: "Feature not found" });
      return;
    }

    // Merge existing tags with updates
    const mergedTags = { ...(element.tags ?? {}), ...tags };

    // Build the update XML
    const tagXml = Object.entries(mergedTags)
      .map(([k, v]) => `    <tag k="${escapeXml(k)}" v="${escapeXml(v)}"/>`)
      .join("\n");

    let elementXml: string;
    if (osmType === "node") {
      elementXml = `<node id="${element.id}" version="${element.version}" changeset="${changesetId}" lat="${element.lat}" lon="${element.lon}">
${tagXml}
</node>`;
    } else {
      elementXml = `<${osmType} id="${element.id}" version="${element.version}" changeset="${changesetId}">
${tagXml}
</${osmType}>`;
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<osm version="0.6">\n${elementXml}\n</osm>`;

    const updateRes = await fetch(`${OSM_API}/${osmType}/${osmId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "text/xml",
      },
      body: xml,
    });

    if (updateRes.status === 401) {
      res.status(401).json({ error: "OSM authentication expired" });
      return;
    }

    if (!updateRes.ok) {
      const body = await updateRes.text();
      req.log.error({ status: updateRes.status, body }, "OSM element update failed");
      res.status(502).json({ error: "Failed to update element" });
      return;
    }

    res.json({ ok: true, newVersion: await updateRes.text() });
  } catch (err) {
    req.log.error({ err }, "Failed to update feature tags");
    res.status(502).json({ error: "Failed to reach OSM API" });
  }
});

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export default router;

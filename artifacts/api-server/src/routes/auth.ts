import { Router, type IRouter, type Request, type Response } from "express";
import crypto from "node:crypto";

const router: IRouter = Router();

const OSM_OAUTH_BASE = "https://www.openstreetmap.org";
const OSM_API = "https://api.openstreetmap.org/api/0.6";

declare module "express-session" {
  interface SessionData {
    osmAccessToken?: string;
    osmUser?: {
      id: string;
      username: string;
      displayName: string;
      avatarUrl: string | null;
      changesetCount: number | null;
    };
    oauthState?: string;
    codeVerifier?: string;
  }
}

function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString("base64url");
}

function generateCodeChallenge(verifier: string): string {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}

// GET /api/auth/osm/login
router.get("/auth/osm/login", (req: Request, res: Response) => {
  const clientId = process.env.OSM_CLIENT_ID;
  if (!clientId) {
    res.status(503).json({
      error:
        "OSM OAuth not configured. Set OSM_CLIENT_ID and OSM_CLIENT_SECRET environment variables.",
    });
    return;
  }

  const state = crypto.randomBytes(16).toString("hex");
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);

  req.session.oauthState = state;
  req.session.codeVerifier = codeVerifier;

  const redirectUri = buildRedirectUri(req);
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "read_prefs write_api",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  res.redirect(`${OSM_OAUTH_BASE}/oauth2/authorize?${params.toString()}`);
});

// GET /api/auth/osm/callback
router.get("/auth/osm/callback", async (req: Request, res: Response) => {
  const { code, state } = req.query as { code?: string; state?: string };
  const clientId = process.env.OSM_CLIENT_ID;
  const clientSecret = process.env.OSM_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    res.status(503).json({ error: "OSM OAuth not configured" });
    return;
  }

  if (!code || !state || state !== req.session.oauthState) {
    res.status(400).json({ error: "Invalid OAuth state" });
    return;
  }

  const codeVerifier = req.session.codeVerifier;
  if (!codeVerifier) {
    res.status(400).json({ error: "Missing code verifier" });
    return;
  }

  delete req.session.oauthState;
  delete req.session.codeVerifier;

  const redirectUri = buildRedirectUri(req);

  try {
    const tokenRes = await fetch(`${OSM_OAUTH_BASE}/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
        code_verifier: codeVerifier,
      }).toString(),
    });

    if (!tokenRes.ok) {
      req.log.error({ status: tokenRes.status }, "OSM token exchange failed");
      res.status(502).json({ error: "Token exchange failed" });
      return;
    }

    const tokenData = (await tokenRes.json()) as { access_token?: string };
    const accessToken = tokenData.access_token;
    if (!accessToken) {
      res.status(502).json({ error: "No access token received" });
      return;
    }

    // Fetch user details
    const userRes = await fetch(`${OSM_API}/user/details.json`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (userRes.ok) {
      const userData = (await userRes.json()) as {
        user?: {
          id: number;
          display_name: string;
          img?: { href: string };
          changesets?: { count: number };
        };
      };
      const user = userData.user;
      if (user) {
        req.session.osmUser = {
          id: String(user.id),
          username: user.display_name,
          displayName: user.display_name,
          avatarUrl: user.img?.href ?? null,
          changesetCount: user.changesets?.count ?? null,
        };
      }
    }

    req.session.osmAccessToken = accessToken;

    // Redirect to app root
    res.redirect("/");
  } catch (err) {
    req.log.error({ err }, "OAuth callback error");
    res.status(500).json({ error: "Authentication failed" });
  }
});

// GET /api/auth/me
router.get("/auth/me", (req: Request, res: Response) => {
  if (!req.session.osmUser) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  res.json(req.session.osmUser);
});

// POST /api/auth/logout
router.post("/auth/logout", (req: Request, res: Response) => {
  req.session.destroy((err) => {
    if (err) {
      req.log.error({ err }, "Session destroy error");
    }
  });
  res.json({ ok: true });
});

function buildRedirectUri(req: Request): string {
  const appUrl = process.env.APP_URL;
  if (appUrl) {
    return `${appUrl}/api/auth/osm/callback`;
  }
  const proto = req.headers["x-forwarded-proto"] ?? req.protocol ?? "https";
  const host = req.headers["x-forwarded-host"] ?? req.headers.host ?? "localhost";
  return `${proto}://${host}/api/auth/osm/callback`;
}

export default router;

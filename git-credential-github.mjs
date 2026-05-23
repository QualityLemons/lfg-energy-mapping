#!/usr/bin/env node
// Replit GitHub credential helper / setup tool.
//
// USAGE:
//   node git-credential-github.mjs --setup
//     Fetches the GitHub OAuth token from Replit's connector and writes it to
//     ~/.git-credentials so git push works without any prompts.
//
//   (called automatically by git when credential.helper is set to this script)
//     Prints the token in git credential protocol format.
//
// Run --setup again any time the token expires.

import { createRequire } from "module";
import { writeFileSync } from "fs";
import { homedir } from "os";
import { execSync } from "child_process";

const require = createRequire(import.meta.url);

async function getToken() {
  const identity = process.env.REPL_IDENTITY;
  if (!identity) throw new Error("REPL_IDENTITY not set — are you running inside Replit?");

  // Replit connectors proxy: use the SDK to make a request that returns our own connection settings.
  // The SDK builds the correct X-Replit-Token header from REPL_IDENTITY.
  const sdkPath =
    "/home/runner/workspace/node_modules/.pnpm/@replit+connectors-sdk@0.4.1/node_modules/@replit/connectors-sdk";

  try {
    const { ReplitConnectors } = require(sdkPath);
    const connectors = new ReplitConnectors();
    // The /me/connections endpoint returns our connections
    const resp = await connectors.proxy("github", "/user", { method: "GET" });
    // This verifies auth works but doesn't give us the raw token.
    // Use the identity-based fetch below instead.
  } catch {}

  // Direct call to Replit connections REST API with correct auth header
  const headers = {
    "X-Replit-Token": `repl ${identity}`,
    "Accept": "application/json",
  };

  // Try to get the token via the replit CLI identity token + connections API
  try {
    const identityToken = execSync(
      "replit identity create --audience https://connectors.replit.com",
      { encoding: "utf8" }
    ).trim();

    const apiResp = await fetch(
      "https://connectors.replit.com/api/v2/connections?connector_name=github",
      { headers: { "X-Replit-Token": `repl ${identityToken}`, "Accept": "application/json" } }
    );
    if (apiResp.ok) {
      const data = await apiResp.json();
      const conn = Array.isArray(data) ? data[0] : data?.connections?.[0];
      const token = conn?.settings?.access_token;
      if (token) return token;
    }
  } catch {}

  throw new Error(
    "Could not retrieve GitHub token. Re-run inside Replit and make sure the GitHub integration is connected."
  );
}

const isSetup = process.argv.includes("--setup");

try {
  const token = await getToken();

  if (isSetup) {
    // Write to git credential store
    execSync("git config --global credential.helper store");
    writeFileSync(`${homedir()}/.git-credentials`, `https://x-oauth-basic:${token}@github.com\n`, {
      mode: 0o600,
    });
    console.log("✓ GitHub credentials stored. git push origin main will now work automatically.");
  } else {
    // Called by git credential protocol — print in expected format
    process.stdout.write(
      `protocol=https\nhost=github.com\nusername=x-oauth-basic\npassword=${token}\n`
    );
  }
} catch (err) {
  if (isSetup) {
    console.error("✗", err.message);
    process.exit(1);
  } else {
    process.stderr.write(`git-credential-github: ${err.message}\n`);
    process.exit(1);
  }
}

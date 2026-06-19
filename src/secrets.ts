import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";

/**
 * Local secrets store for runtime-editable triage config (base URL + API key) set via the admin
 * console. A gitignored JSON file with 0600 perms — NOT the ClickHouse store (a secret must never
 * land in the analytics DB / its backups). Reading/writing is best-effort and never throws.
 *
 * SECURITY: editing these over the (unauthenticated) console is a deliberate local-only trade-off —
 * a mutable base URL means the key is sent wherever it points. Keep crowsnest on a trusted host.
 */
export interface Secrets {
  baseUrl?: string;
  apiKey?: string;
}

export function secretsPath(): string {
  return process.env.CROWSNEST_SECRETS ?? ".crowsnest-secrets.json";
}

export function readSecrets(path: string = secretsPath()): Secrets {
  try {
    if (!existsSync(path)) return {};
    const parsed = JSON.parse(readFileSync(path, "utf8")) as Secrets;
    return { baseUrl: parsed.baseUrl, apiKey: parsed.apiKey };
  } catch {
    return {};
  }
}

export function writeSecrets(partial: Secrets, path: string = secretsPath()): void {
  const merged = { ...readSecrets(path), ...partial };
  writeFileSync(path, JSON.stringify(merged, null, 2), { mode: 0o600 });
  try {
    chmodSync(path, 0o600); // ensure 0600 even if the file pre-existed with looser perms
  } catch {
    /* best effort */
  }
}

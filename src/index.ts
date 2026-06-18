// crowsnest entrypoint.
// M1 wires the stateless ingest server (POST /v1/events → Store) here.
import { SCHEMA_VERSION } from "./schema.js";

console.log(`crowsnest (event schema v${SCHEMA_VERSION}) — ingest server not wired yet (M1).`);

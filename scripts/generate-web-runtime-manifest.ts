#!/usr/bin/env node
// @ts-nocheck
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WEB_RUNTIME_MANIFEST } from "../lib/web-plugin-registry.ts";

const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(projectDir, "web-runtime", "modules.json");
fs.writeFileSync(output, `${JSON.stringify(WEB_RUNTIME_MANIFEST, null, 2)}\n`);
process.stdout.write(`${output}\n`);
// @ts-nocheck

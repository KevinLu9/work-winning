// npm run test:parity — checks the in-browser API used by the shareable HTML matches the Flask API.
// 1. export the synthetic database + bootstrap  2. replay the cases through Flask  3. replay through the TS port and diff.
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import zlib from "node:zlib"

const root = path.resolve(import.meta.dirname, "..")
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "owwh-parity-"))
const run = (cmd, args, cwd = root) => execFileSync(cmd, args, { cwd, stdio: "inherit" })

// The cases need the synthetic dataset (content, approvals, governance queues) to exercise every route.
run(path.join(root, ".venv/bin/python"), ["-m", "server.export_offline", "--synthetic"])
const db = zlib.gunzipSync(fs.readFileSync(path.join(root, "client/offline-data/owwh.db.gz")))
// Separate copies: both sides write (audit log, submissions) while replaying the cases.
fs.writeFileSync(path.join(tmp, "flask.db"), db)
fs.writeFileSync(path.join(tmp, "offline.db"), db)

run(path.join(root, ".venv/bin/python"), ["-m", "server.tests.parity_dump", path.join(tmp, "flask.db"), path.join(tmp, "flask.json")])
try {
  run("npx", ["tsx", "scripts/parity.ts", path.join(tmp, "offline.db"), "offline-data/bootstrap.json", path.join(tmp, "flask.json")], path.join(root, "client"))
} finally {
  fs.rmSync(tmp, { recursive: true, force: true })
}

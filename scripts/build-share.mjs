// npm run build:share [--synthetic] — builds one self-contained HTML file of the app.
// Default: only the real Salesforce export → share/owwh-real.html
// --synthetic (or npm run build:share:synthetic): plus generated demo data → share/owwh-synthetic.html
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"

const root = path.resolve(import.meta.dirname, "..")
// `npm run build:share --synthetic` arrives as npm_config_synthetic=true; `node scripts/build-share.mjs --synthetic` as an argument.
const synthetic = process.argv.includes("--synthetic") || ["true", "1"].includes(String(process.env.npm_config_synthetic).toLowerCase())
const mode = synthetic ? "synthetic" : "real"
const run = (cmd, args, cwd = root) => execFileSync(cmd, args, { cwd, stdio: "inherit" })

run(path.join(root, ".venv/bin/python"), ["-m", "server.export_offline", ...(synthetic ? ["--synthetic"] : [])])
run("npm", ["run", "build:share"], path.join(root, "client"))

const out = path.join(root, "share", `owwh-${mode}.html`)
fs.mkdirSync(path.dirname(out), { recursive: true })
fs.copyFileSync(path.join(root, "client/dist-share/index.html"), out)
console.log(`Created ${path.relative(root, out)} (${(fs.statSync(out).size / 1e6).toFixed(1)} MB, ${mode} data)`)

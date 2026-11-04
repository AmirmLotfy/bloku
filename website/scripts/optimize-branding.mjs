import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = "assets/branding/original.png";
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const input = await fs.readFile(path.join(root, source));
const originalSha256 = "f191e688ae0f8bbbff20bd9796ae68c60b73adb8030a34110d00b9d4b5768331";
if (hash(input) !== originalSha256) throw new Error("Original BLOKU brand source changed; review before resampling.");
const files = [];
for (const [name, pixels, format] of [
  ["bloku-logo.png", 204, "png"],
  ["favicon.png", 32, "png"],
  ["apple-touch-icon.png", 180, "png"],
  ["favicon.ico", 32, "ico"],
]) {
  const target = path.join(root, "public", name);
  execFileSync("sips", ["-s", "format", format, "--resampleHeightWidth", String(pixels), String(pixels), path.join(root, source), "--out", target], { stdio: "pipe" });
  const bytes = await fs.readFile(target);
  files.push({ path: `public/${name}`, width: pixels, height: pixels, bytes: bytes.length, sha256: hash(bytes) });
}
await fs.writeFile(path.join(root, "assets/branding/provenance.json"), JSON.stringify({
  method: "Native macOS sips resampling of the original unchanged BLOKU artwork; no generative editing.",
  source: { path: source, width: 1000, height: 1000, bytes: input.length, sha256: originalSha256 },
  files,
}, null, 2) + "\n");
console.log(JSON.stringify({ sourceSha256: originalSha256, files }, null, 2));

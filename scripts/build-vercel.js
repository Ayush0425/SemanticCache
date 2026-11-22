import { copyFile, mkdir, readdir, readFile, writeFile } from "node:fs/promises";

const output = new URL("../dist/", import.meta.url);
const source = new URL("../src/public/", import.meta.url);
const assets = ["playground.css", "playground.js", "stats.js"];
const allowed = new Set(["index.html", ...assets]);
await mkdir(output, { recursive: true });
for (const entry of await readdir(output, { withFileTypes: true })) {
    if (!entry.isFile() || !allowed.has(entry.name)) {
        throw new Error("Unexpected files in dist. Build in a clean checkout.");
    }
}
const markup = await readFile(new URL("index.html", source), "utf8");
const marker = 'id="hosted-notice" hidden';
if (!markup.includes(marker)) throw new Error("The hosted prompt notice is missing.");
await writeFile(new URL("index.html", output), markup.replace(marker, 'id="hosted-notice"'));
for (const filename of assets) {
    await copyFile(new URL(filename, source), new URL(filename, output));
}

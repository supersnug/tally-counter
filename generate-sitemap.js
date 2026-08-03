import { mkdir, readFile, writeFile } from "node:fs/promises";

const siteUrl = process.env.SITE_URL;

if (!siteUrl) {
  throw new Error("SITE_URL is required");
}

const sourceFiles = [
  "src/pages/GuidePage.tsx",
  "src/pages/DeveloperGuidePage.tsx",
];

const routes = new Set(["/"]);

for (const file of sourceFiles) {
  const source = await readFile(file, "utf8");

  for (const match of source.matchAll(/\[\s*"(\/(?:guide|developers)[^"]*)"/g)) {
    routes.add(match[1]);
  }
}

const escapeXml = (value) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

const urls = [...routes]
  .sort()
  .map((route) => {
    const url = new URL(route, siteUrl).href;

    return `  <url>
    <loc>${escapeXml(url)}</loc>
  </url>`;
  })
  .join("\n");

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;

await mkdir("public", { recursive: true });
await writeFile("public/sitemap.xml", sitemap);

console.log(`Generated sitemap with ${routes.size} URLs.`);
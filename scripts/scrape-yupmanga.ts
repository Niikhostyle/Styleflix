/**
 * Scrape + descarga mangas en español desde YupManga.
 *
 * Uso:
 *   npx tsx scripts/scrape-yupmanga.ts
 *   npx tsx scripts/scrape-yupmanga.ts --limit=24
 *   npx tsx scripts/scrape-yupmanga.ts --with-chapters
 *   npx tsx scripts/scrape-yupmanga.ts --download --out "G:/Mi unidad/veotv" --limit=5 --max-chapters=3
 *
 * --download: guarda páginas JPG bajo {out}/manga/yup-{slug}/cap-{n}/001.jpg
 * Requiere curl en PATH (Cloudflare bloquea fetch de Node).
 */

import { mkdir, writeFile, stat } from "node:fs/promises";
import path from "node:path";
import {
  downloadYupImage,
  fetchYupChapters,
  fetchYupChapterPageUrls,
  fetchYupMangaDetails,
  fetchYupPopular,
  writeYupCatalogCache,
  type YupMangaEntry,
  type YupMangaDetail,
} from "../lib/yupmanga";

function argValue(name: string, fallback: string) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

function hasFlag(name: string) {
  return process.argv.includes(`--${name}`);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function safeName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
    .replace(/[. ]+$/g, "")
    .trim()
    .slice(0, 80) || "manga";
}

async function main() {
  const limit = Math.max(1, Number(argValue("limit", "40")) || 40);
  const withChapters = hasFlag("with-chapters") || hasFlag("download");
  const doDownload = hasFlag("download");
  const maxChapters = Math.max(1, Number(argValue("max-chapters", "999")) || 999);
  const outRoot = argValue("out", path.join(process.cwd(), "data", "yupmanga-files"));

  console.log(`[yupmanga] catálogo top/home (limit=${limit})…`);
  const popular = await fetchYupPopular(limit);
  if (!popular.length) {
    console.error("[yupmanga] sin resultados (¿curl / Cloudflare?)");
    process.exit(1);
  }

  const enriched: YupMangaEntry[] = [];
  const bySlugDir = path.join(process.cwd(), "data", "mangas-es", "by-slug");
  await mkdir(bySlugDir, { recursive: true });

  for (let i = 0; i < popular.length; i++) {
    const item = popular[i];
    console.log(`[yupmanga] (${i + 1}/${popular.length}) ${item.title}`);
    const details = await fetchYupMangaDetails(item.id);
    const base = details || item;
    let chapters: Awaited<ReturnType<typeof fetchYupChapters>> = [];
    if (withChapters) {
      chapters = await fetchYupChapters(item.id);
      await sleep(200);
    }

    const entry: YupMangaEntry = {
      ...base,
      slug: item.slug,
      poster: details?.poster || item.poster,
      synopsis: details?.synopsis || item.synopsis,
      genres: details?.genres?.length ? details.genres : item.genres,
      chapterCount: chapters.length || null,
      lastChapter: chapters.length
        ? chapters[chapters.length - 1].chapter
        : null,
      source: "yupmanga",
    };
    enriched.push(entry);

    const detail: YupMangaDetail = {
      ...entry,
      chapters,
      contentRating: null,
      scrapedAt: new Date().toISOString(),
    };
    await writeFile(
      path.join(bySlugDir, `${entry.slug}.json`),
      JSON.stringify(detail, null, 2),
      "utf8"
    );

    if (doDownload && chapters.length) {
      const mangaDir = path.join(
        outRoot,
        "manga",
        safeName(`${entry.slug}`)
      );
      await mkdir(mangaDir, { recursive: true });
      const slice = chapters.slice(0, maxChapters);
      for (const ch of slice) {
        const capDir = path.join(
          mangaDir,
          `cap-${safeName(ch.chapter)}`
        );
        await mkdir(capDir, { recursive: true });
        console.log(`  cap ${ch.chapter} (${ch.title})…`);
        const pages = await fetchYupChapterPageUrls(item.id, ch.id);
        if (!pages?.urls.length) {
          console.warn(`  ! sin páginas para cap ${ch.chapter}`);
          continue;
        }
        let okPages = 0;
        for (let p = 0; p < pages.urls.length; p++) {
          const dest = path.join(
            capDir,
            `${String(p + 1).padStart(3, "0")}.jpg`
          );
          try {
            const st = await stat(dest).catch(() => null);
            if (st && st.size > 1000) {
              okPages += 1;
              continue;
            }
          } catch {
            /* download */
          }
          const ok = downloadYupImage(pages.urls[p], dest);
          if (!ok) break;
          const st = await stat(dest).catch(() => null);
          if (!st || st.size < 500) {
            // fin de capítulo / error JSON
            break;
          }
          okPages += 1;
          await sleep(80);
        }
        console.log(`  → ${okPages} páginas en ${capDir}`);
        await sleep(300);
      }
    }
  }

  await writeYupCatalogCache(enriched);
  console.log(
    `[yupmanga] listo: ${enriched.length} títulos → data/mangas-es/catalog.json`
  );
  if (doDownload) {
    console.log(`[yupmanga] archivos en ${outRoot}/manga/`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

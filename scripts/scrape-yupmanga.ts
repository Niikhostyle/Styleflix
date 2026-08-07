/**
 * Scrape + descarga mangas en español desde YupManga.
 *
 * Uso:
 *   npx tsx scripts/scrape-yupmanga.ts --all
 *   npx tsx scripts/scrape-yupmanga.ts --all --download --out "G:/Mi unidad/veotv"
 *   npx tsx scripts/scrape-yupmanga.ts --limit=24 --with-chapters
 *
 * --all: catálogo completo (/all + home + top + búsquedas), sin tope
 * --download: guarda páginas JPG bajo {out}/manga/yup-{slug}/cap-{n}/001.jpg
 * Requiere curl en PATH (Cloudflare bloquea fetch de Node).
 */

import { mkdir, writeFile, stat } from "node:fs/promises";
import path from "node:path";
import {
  downloadYupImage,
  fetchYupAllCatalog,
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
  return (
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
      .replace(/[. ]+$/g, "")
      .trim()
      .slice(0, 80) || "manga"
  );
}

async function main() {
  const all = hasFlag("all");
  const limit = all
    ? Number.POSITIVE_INFINITY
    : Math.max(1, Number(argValue("limit", "40")) || 40);
  const withChapters = hasFlag("with-chapters") || hasFlag("download") || all;
  const doDownload = hasFlag("download");
  const maxChapters = all
    ? Number.POSITIVE_INFINITY
    : Math.max(1, Number(argValue("max-chapters", "999")) || 999);
  const outRoot = argValue(
    "out",
    path.join(process.cwd(), "data", "yupmanga-files")
  );
  const resume = !hasFlag("no-resume");

  console.log(
    all
      ? `[yupmanga] catálogo COMPLETO + capítulos${doDownload ? " + descarga" : ""}…`
      : `[yupmanga] catálogo (limit=${limit})…`
  );

  const popular = all
    ? await fetchYupAllCatalog((m) => console.log(m))
    : await fetchYupPopular(Number.isFinite(limit) ? limit : 40);

  const list = Number.isFinite(limit) ? popular.slice(0, limit) : popular;
  if (!list.length) {
    console.error("[yupmanga] sin resultados (¿curl / Cloudflare?)");
    process.exit(1);
  }
  console.log(`[yupmanga] series a procesar: ${list.length}`);

  const enriched: YupMangaEntry[] = [];
  const bySlugDir = path.join(process.cwd(), "data", "mangas-es", "by-slug");
  await mkdir(bySlugDir, { recursive: true });

  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    console.log(`[yupmanga] (${i + 1}/${list.length}) ${item.title}`);
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

    // Guardar catálogo parcial cada 10 series (por si corta)
    if ((i + 1) % 10 === 0 || i === list.length - 1) {
      await writeYupCatalogCache(enriched);
    }

    if (doDownload && chapters.length) {
      const mangaDir = path.join(outRoot, "manga", safeName(entry.slug));
      await mkdir(mangaDir, { recursive: true });
      const slice = chapters.slice(
        0,
        Number.isFinite(maxChapters) ? maxChapters : chapters.length
      );
      for (const ch of slice) {
        const capDir = path.join(mangaDir, `cap-${safeName(ch.chapter)}`);
        await mkdir(capDir, { recursive: true });

        if (resume) {
          try {
            const marker = path.join(capDir, "_done.txt");
            const st = await stat(marker).catch(() => null);
            if (st) {
              console.log(`  cap ${ch.chapter} ya descargado, skip`);
              continue;
            }
          } catch {
            /* continue */
          }
        }

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
          if (!st || st.size < 500) break;
          okPages += 1;
          await sleep(60);
        }
        console.log(`  → ${okPages} páginas`);
        if (okPages > 0) {
          await writeFile(
            path.join(capDir, "_done.txt"),
            `${okPages}\n${new Date().toISOString()}\n`,
            "utf8"
          );
        }
        await sleep(250);
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

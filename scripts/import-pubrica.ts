import path from "path"
import dotenv from "dotenv"
import axios from "axios"
import * as cheerio from "cheerio"
import he from "he"
import fs from "fs"
import crypto from "crypto"

dotenv.config({ path: path.resolve(process.cwd(), ".env") })

const { default: config } = await import("../src/payload.config")
const { getPayload } = await import("payload")

const BASE = "https://pubrica.com"

// Maps the first URL path segment on pubrica.com to our Posts.source value.
const SECTION_MAP: Record<string, string> = {
  blog: "blog",
  insights: "insights",
  academy: "academy",
  careers: "career",
}

const limitArg = process.argv.find((a) => a.startsWith("--limit="))
const LIMIT = limitArg ? parseInt(limitArg.split("=")[1], 10) : Infinity
// Skip anything already in the DB entirely (no update call) so previously
// fixed fields (seo.metaTitle, rewritten internal links, etc.) are untouched.
const NEW_ONLY = process.argv.includes("--new-only")

// Older posts (pre-2023) have media/links hardcoded to the site's raw server IP
// from before it sat behind a domain + TLS. That IP no longer accepts connections
// on its own, so rewrite it to the real domain wherever it shows up.
const LEGACY_IP_HOST = "52.49.174.246"
function normalizeUrl(rawUrl: string): string {
  try {
    const u = new URL(rawUrl, BASE)
    if (u.hostname === LEGACY_IP_HOST) {
      u.protocol = "https:"
      u.hostname = "pubrica.com"
      u.port = ""
      // The legacy IP served academy uploads under /academy/wp-content/..., but on
      // the real domain that content now lives at the site root /wp-content/...
      u.pathname = u.pathname.replace(/^\/academy\//, '/')
    }
    return u.toString()
  } catch {
    return rawUrl
  }
}

// ===============================
// MEDIA
// ===============================

const mediaCache = new Map<string, number>()

async function preloadMediaCache(payload: any) {
  const result = await payload.find({ collection: "media", limit: 0, pagination: false, select: { filename: true } })
  for (const doc of result.docs) {
    if (doc.filename) mediaCache.set(doc.filename, doc.id)
  }
  console.log("Preloaded media cache:", mediaCache.size)
}

const MAX_DOWNLOAD_BYTES = 80 * 1024 * 1024 // safety cap so a stray huge video doesn't hang the import

async function downloadWithBackoff(url: string, maxRetries = 5): Promise<Buffer> {
  let delayMs = 8000
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await axios.get(url, {
        responseType: "arraybuffer",
        timeout: 180000,
        maxContentLength: MAX_DOWNLOAD_BYTES,
        maxBodyLength: MAX_DOWNLOAD_BYTES,
      })
      return Buffer.from(response.data)
    } catch (error) {
      const status = axios.isAxiosError(error) ? error.response?.status : undefined
      if (status === 429 && attempt < maxRetries) {
        const retryAfterHeader = axios.isAxiosError(error) ? error.response?.headers?.["retry-after"] : undefined
        const retryAfterSec = retryAfterHeader ? Number(retryAfterHeader) : NaN
        const waitMs = Number.isFinite(retryAfterSec) ? retryAfterSec * 1000 : delayMs
        console.log(`Rate limited, waiting ${waitMs}ms (attempt ${attempt}/${maxRetries}):`, url)
        await new Promise((r) => setTimeout(r, waitMs))
        delayMs *= 2
        continue
      }
      throw error
    }
  }
  throw new Error("unreachable")
}

async function getOrUploadMedia(url: string, title: string, altText: string, payload: any) {
  if (url.startsWith("data:")) throw new Error("data: URI, not a real image")
  const fileName = decodeURIComponent(path.basename(new URL(url).pathname))
  if (!fileName) throw new Error(`empty filename from URL: ${url}`)
  const cached = mediaCache.get(fileName)
  if (cached) return cached

  const buffer = await downloadWithBackoff(url)
  const tempPath = path.join(process.cwd(), fileName)
  fs.writeFileSync(tempPath, buffer)

  try {
    const media = await payload.create({
      collection: "media",
      data: { title, altText },
      filePath: tempPath,
    })
    mediaCache.set(fileName, media.id)
    return media.id
  } finally {
    fs.unlinkSync(tempPath)
  }
}

// ===============================
// CATEGORIES / TAGS
// ===============================

const categoryCache = new Map<number, number>()
const tagCache = new Map<number, number>()
const sectionCategoryCache = new Map<string, number>()

async function getOrCreateTerm(wpTerm: any, collection: "categories" | "tags", payload: any) {
  const cache = collection === "categories" ? categoryCache : tagCache
  const cached = cache.get(wpTerm.id)
  if (cached) return cached

  const existing = await payload.find({
    collection,
    where: { slug: { equals: wpTerm.slug } },
  })

  if (existing.docs.length) {
    cache.set(wpTerm.id, existing.docs[0].id)
    return existing.docs[0].id
  }

  const created = await payload.create({
    collection,
    data: { name: he.decode(wpTerm.name), slug: wpTerm.slug },
  })

  cache.set(wpTerm.id, created.id)
  return created.id
}

// WordPress `page` objects have no taxonomy, so tag them with a category
// matching their section (Academy / Insights / Career) for basic browsing.
async function getOrCreateSectionCategory(source: string, payload: any) {
  const cached = sectionCategoryCache.get(source)
  if (cached) return cached

  const existing = await payload.find({
    collection: "categories",
    where: { slug: { equals: source } },
  })

  if (existing.docs.length) {
    sectionCategoryCache.set(source, existing.docs[0].id)
    return existing.docs[0].id
  }

  const created = await payload.create({
    collection: "categories",
    data: { name: source.charAt(0).toUpperCase() + source.slice(1), slug: source },
  })

  sectionCategoryCache.set(source, created.id)
  return created.id
}

// ===============================
// INLINE RICH TEXT
// ===============================

function parseInline($: any, nodes: any[], format = 0): any[] {
  const result: any[] = []
  for (const node of nodes || []) {
    if (node.type === "text") {
      const text = he.decode((node.data || "").replace(/\s+/g, " "))
      if (text.trim()) {
        result.push({ type: "text", version: 1, detail: 0, format, mode: "normal", style: "", text })
      }
      continue
    }
    if (node.type === "tag") {
      const tag = node.tagName?.toLowerCase()
      if (tag === "a") {
        let href = $(node).attr("href")?.replace(/["']/g, "").trim()
        if (href) {
          try { href = encodeURI(decodeURI(href)) } catch { href = encodeURI(href) }
          if (/^https?:\/\//i.test(href)) href = normalizeUrl(href)
        }
        const innerChildren = parseInline($, node.children, format)
        if (href && !href.startsWith("blob:") && !href.startsWith("javascript:")) {
          result.push({
            type: "link", version: 3, direction: "ltr", format: "", indent: 0,
            fields: { linkType: "custom", url: href, newTab: $(node).attr("target") === "_blank" },
            children: innerChildren.length ? innerChildren : [{ type: "text", version: 1, detail: 0, format, mode: "normal", style: "", text: $(node).text() }],
          })
        } else {
          result.push(...innerChildren)
        }
        continue
      }
      if (tag === "strong" || tag === "b") { result.push(...parseInline($, node.children, format | 1)); continue }
      if (tag === "em" || tag === "i") { result.push(...parseInline($, node.children, format | 2)); continue }
      result.push(...parseInline($, node.children, format))
    }
  }
  return result
}

// ===============================
// CONTENT BLOCKS (headings/paragraphs/lists/images/PDFs/videos)
// ===============================

async function cleanWordPressContent(html: string, payload: any, postTitle?: string) {
  const $ = cheerio.load(html)

  $('.elementor-widget-icon-list').remove()

  const normalizedTitle = postTitle?.trim().toLowerCase()
  $('.elementor-widget-heading h1, .elementor-widget-heading h2, .elementor-widget-heading h3, .elementor-widget-heading h4').each((_, el) => {
    const text = $(el).text().trim().toLowerCase()
    if (text === normalizedTitle || text === 'table of content' || text === 'table of contents') {
      $(el).closest('.elementor-widget-heading').remove()
    }
  })

  // PDFs are embedded on pubrica.com as <iframe src="....pdf">. Swap them for a
  // placeholder marker BEFORE the generic iframe strip below removes them.
  $('iframe[src]').each((_, el) => {
    const src = ($(el).attr('src') || '').replace(/["']/g, '').trim()
    if (/\.pdf(\?|#|$)/i.test(src)) {
      $(el).replaceWith(`<div data-embed-type="file" data-embed-src="${src}"></div>`)
    }
  })

  // Self-hosted <video> tags (mp4 etc.)
  $('video').each((_, el) => {
    let src = ($(el).attr('src') || '').trim()
    if (!src) src = ($(el).find('source').first().attr('src') || '').trim()
    if (src) {
      $(el).replaceWith(`<div data-embed-type="file" data-embed-src="${src}"></div>`)
    }
  })

  $('script,style,svg,iframe,noscript,video').remove()
  $('*').removeAttr('class')
  $('*').removeAttr('style')

  const blocks: any[] = []

  for (const element of $('h1,h2,h3,h4,p,li,img,div[data-embed-type="file"]').toArray()) {
    const tag = element.tagName

    if (tag === 'div' && $(element).attr('data-embed-type') === 'file') {
      const rawSrc = $(element).attr('data-embed-src')
      if (rawSrc) {
        try {
          const absoluteSrc = normalizeUrl(rawSrc)
          const fileName = decodeURIComponent(path.basename(absoluteSrc.split('?')[0]))
          const mediaId = await getOrUploadMedia(
            absoluteSrc,
            fileName.replace(/\.[^.]+$/, ''),
            fileName,
            payload,
          )
          blocks.push({ type: 'upload', id: mediaId })
          console.log("Embedded file imported:", fileName, mediaId)
        } catch (error) {
          console.log("Embedded file failed:", rawSrc, error instanceof Error ? error.message : error)
        }
      }
      continue
    }

    if (tag === 'img') {
      let src = $(element).attr("src")?.replace(/["']/g, "").trim()
      // Lazy-load plugins put a placeholder (often a base64 GIF) in src and the
      // real URL in a data-* attribute until JS swaps it in on scroll.
      if (!src || src.startsWith('data:')) {
        src = ($(element).attr('data-src') || $(element).attr('data-lazy-src') || $(element).attr('data-original') || '')
          .replace(/["']/g, '').trim()
      }
      if (src && !src.startsWith('data:')) {
        try {
          const absoluteSrc = normalizeUrl(src)
          const fileName = decodeURIComponent(path.basename(absoluteSrc.split('?')[0]))
          const altText = $(element).attr('alt') || 'Pubrica image'
          const mediaId = await getOrUploadMedia(
            absoluteSrc,
            fileName.replace(/\.[^.]+$/, ''),
            altText,
            payload,
          )
          blocks.push({ type: 'upload', id: mediaId })
          console.log("Content image imported:", fileName, mediaId)
        } catch (error) {
          console.log("Image failed:", src, error instanceof Error ? error.message : error)
        }
      }
      continue
    }

    const inlineChildren = parseInline($, element.children)
    if (inlineChildren.length) {
      blocks.push({ type: tag, children: inlineChildren })
    }
  }

  return blocks
}

function createLexicalContent(blocks: any[]) {
  return {
    root: {
      type: "root", version: 1, direction: null, format: "", indent: 0,
      children: blocks.map((block) => {
        if (block.type === "upload") {
          return {
            type: "upload",
            version: 3,
            id: crypto.randomBytes(12).toString("hex"),
            relationTo: "media",
            value: block.id,
            fields: null,
            format: "",
          }
        }
        if (["h1", "h2", "h3", "h4"].includes(block.type)) {
          return { type: "heading", version: 1, tag: block.type, direction: null, format: "", indent: 0, children: block.children }
        }
        return { type: "paragraph", version: 1, direction: null, format: "", indent: 0, children: block.children }
      }),
    },
  }
}

async function withRetry<T>(fn: () => Promise<T>, label: string, maxRetries = 3): Promise<T> {
  let delay = 3000
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      if (attempt === maxRetries) throw error
      console.log(`${label} failed (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms`)
      await new Promise((resolve) => setTimeout(resolve, delay))
      delay *= 2
    }
  }
  throw new Error("unreachable")
}

// ===============================
// FETCH + CLASSIFY
// ===============================

async function fetchAllPaginated(endpoint: string, extraParams = ""): Promise<any[]> {
  const all: any[] = []
  let page = 1
  while (true) {
    try {
      const res = await axios.get(`${BASE}/wp-json/wp/v2/${endpoint}?per_page=50&page=${page}${extraParams}`, { timeout: 60000 })
      all.push(...res.data)
      if (res.data.length < 50) break
      page++
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 400) break // past last page
      console.log(`Fetch ${endpoint} page ${page} failed, retrying once...`)
      try {
        const retry = await axios.get(`${BASE}/wp-json/wp/v2/${endpoint}?per_page=50&page=${page}${extraParams}`, { timeout: 60000 })
        all.push(...retry.data)
        if (retry.data.length < 50) break
        page++
      } catch {
        console.log(`Giving up on ${endpoint} page ${page}`)
        break
      }
    }
  }
  return all
}

function classify(link: string): { source: string; urlPath: string } | null {
  const u = new URL(link)
  const segments = u.pathname.split('/').filter(Boolean).map((s) => decodeURIComponent(s))
  if (segments.length === 0) return null
  const first = segments[0].toLowerCase()
  const source = SECTION_MAP[first]
  if (!source) return null
  return { source, urlPath: segments.slice(1).join('/') }
}

// ===============================
// IMPORT
// ===============================

async function run() {
  const payload = await getPayload({ config })
  await preloadMediaCache(payload)

  console.log("Fetching posts...")
  const allPosts = await fetchAllPaginated("posts", "&_embed=true")
  console.log("Total posts:", allPosts.length)

  console.log("Fetching pages...")
  const allPages = await fetchAllPaginated("pages", "&_embed=true")
  console.log("Total pages:", allPages.length)

  const items = [
    ...allPosts.map((wp) => ({ kind: "post" as const, wp })),
    ...allPages.map((wp) => ({ kind: "page" as const, wp })),
  ]

  let imported = 0, updated = 0, skipped = 0, failed = 0, processed = 0
  const failedItems: string[] = []

  for (const { kind, wp } of items) {
    if (processed >= LIMIT) break

    const classified = classify(wp.link)
    if (!classified) { skipped++; continue }
    const { source, urlPath } = classified
    const title = he.decode(wp.title.rendered)

    const existing = await payload.find({
      collection: "posts",
      where: { and: [{ source: { equals: source } }, { urlPath: { equals: urlPath } }] },
    })

    if (NEW_ONLY && existing.docs.length) {
      skipped++
      continue
    }

    processed++
    console.log(`\n[${processed}] (${kind}/${source}) ${title}`)

    try {
      let categoryIds: number[] = []
      let tagIds: number[] = []

      if (kind === "post") {
        const terms: any[] = (wp._embedded?.["wp:term"] || []).flat()
        const wpCategories = terms.filter((t) => t.taxonomy === "category")
        const wpTags = terms.filter((t) => t.taxonomy === "post_tag")
        for (const c of wpCategories) categoryIds.push(await getOrCreateTerm(c, "categories", payload))
        for (const t of wpTags) tagIds.push(await getOrCreateTerm(t, "tags", payload))
      } else {
        categoryIds.push(await getOrCreateSectionCategory(source, payload))
      }

      let heroImage: number | null = null
      const featuredMedia = wp._embedded?.["wp:featuredmedia"]?.[0]
      if (featuredMedia?.source_url) {
        try {
          heroImage = await getOrUploadMedia(
            normalizeUrl(featuredMedia.source_url),
            he.decode(featuredMedia.title?.rendered || title),
            he.decode(featuredMedia.alt_text || title),
            payload,
          )
        } catch (error) {
          console.log("Hero image failed:", error instanceof Error ? error.message : error)
        }
      }

      let blocks = await cleanWordPressContent(wp.content?.rendered || "", payload, title)

      if (blocks.length === 0) {
        const fallbackText = he.decode((wp.excerpt?.rendered || "").replace(/(<([^>]+)>)/gi, "").trim())
        blocks = [{
          type: "paragraph",
          children: [{ type: "text", version: 1, detail: 0, format: 0, mode: "normal", style: "", text: fallbackText || title }],
        }]
      }

      if (!heroImage) {
        const firstUpload = blocks.find((b: any) => b.type === "upload")
        if (firstUpload) heroImage = firstUpload.id
      }

      const content = createLexicalContent(blocks) as any
      const plainExcerpt = he.decode((wp.excerpt?.rendered || "").replace(/(<([^>]+)>)/gi, "").trim()).slice(0, 160)
      const keywords = kind === "post"
        ? ((wp._embedded?.["wp:term"] || []).flat()).map((t: any) => he.decode(t.name)).join(", ")
        : ""

      const data: any = {
        title,
        slug: wp.slug,
        source,
        urlPath,
        heroImage: heroImage || undefined,
        author: "Pubrica",
        categories: categoryIds,
        tags: tagIds,
        content,
        seo: {
          metaTitle: title,
          metaDescription: plainExcerpt || title,
          metaKeywords: keywords,
        },
        publishing: {
          status: wp.status === "publish" ? "published" : "draft",
          publishedAt: wp.date,
        },
      }

      if (existing.docs.length) {
        await withRetry(() => payload.update({ collection: "posts", id: existing.docs[0].id, data }), `update ${urlPath}`)
        updated++
      } else {
        await withRetry(() => payload.create({ collection: "posts", data }), `create ${urlPath}`)
        imported++
      }

      console.log("Done:", source, urlPath || "(root)")
    } catch (error) {
      console.log("FAILED:", title, error instanceof Error ? error.message : error)
      failedItems.push(`${kind}/${source}: ${title}`)
      failed++
    }

    await new Promise((resolve) => setTimeout(resolve, 300))
  }

  console.log("\n======================")
  console.log("Processed:", processed)
  console.log("Imported:", imported)
  console.log("Updated:", updated)
  console.log(NEW_ONLY ? "Skipped (outside sections or already exists):" : "Skipped (outside blog/insights/academy/career):", skipped)
  console.log("Failed:", failed)
  if (failedItems.length) console.log("Failed items:", failedItems)

  process.exit()
}

run()

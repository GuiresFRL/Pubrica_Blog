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

const WP_PAGES_API = "https://tutorsindia.net/academy/wp-json/wp/v2/pages"

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

async function getOrUploadMedia(fileName: string, downloadFn: () => Promise<Buffer>, title: string, altText: string, payload: any) {
  const cached = mediaCache.get(fileName)
  if (cached) return cached

  const buffer = await downloadFn()
  const tempPath = path.join(process.cwd(), fileName)
  fs.writeFileSync(tempPath, buffer)

  const media = await payload.create({
    collection: "media",
    data: { title, altText },
    filePath: tempPath,
  })

  fs.unlinkSync(tempPath)
  mediaCache.set(fileName, media.id)
  return media.id
}

// ===============================
// CATEGORIES
// ===============================

const categoryCache = new Map<string, number>()

async function getOrCreateCategory(name: string, slug: string, payload: any) {
  const cached = categoryCache.get(slug)
  if (cached) return cached

  const existing = await payload.find({
    collection: "categories",
    where: { slug: { equals: slug } },
  })

  if (existing.docs.length) {
    categoryCache.set(slug, existing.docs[0].id)
    return existing.docs[0].id
  }

  const created = await payload.create({
    collection: "categories",
    data: { name, slug },
  })

  categoryCache.set(slug, created.id)
  return created.id
}

// ===============================
// INLINE RICH TEXT (same logic as import-academy.ts)
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

  $('script,style,svg,iframe,noscript').remove()
  $('*').removeAttr('class')
  $('*').removeAttr('style')

  const blocks: any[] = []

  for (const element of $('h1,h2,h3,h4,p,li,img').toArray()) {
    const tag = element.tagName

    if (tag === 'img') {
      const src = $(element).attr("src")?.replace(/["']/g, "").trim()
      if (src) {
        try {
          const fileName = path.basename(src.split('?')[0])
          const altText = $(element).attr('alt') || 'Academy image'
          const mediaId = await getOrUploadMedia(
            fileName,
            async () => {
              const response = await axios.get(src, { responseType: 'arraybuffer', timeout: 120000 })
              return Buffer.from(response.data)
            },
            fileName.replace(/\.[^.]+$/, ''),
            altText,
            payload,
          )
          blocks.push({ type: 'image', id: mediaId })
          console.log("Content Image Imported:", fileName, mediaId)
        } catch (error) {
          console.log("Image failed:", src)
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
        if (block.type === "image") {
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
// FETCH ALL PAGES + BUILD TREE
// ===============================

async function fetchAllPages() {
  let all: any[] = []
  let page = 1
  while (true) {
    const res = await axios.get(`${WP_PAGES_API}?per_page=100&page=${page}`)
    all.push(...res.data)
    if (res.data.length < 100) break
    page++
  }
  return all
}

function buildAncestorPath(pageId: number, byId: Map<number, any>): string[] {
  const chain: string[] = []
  let current = byId.get(pageId)
  const visited = new Set<number>()
  while (current && current.parent && !visited.has(current.parent)) {
    visited.add(current.parent)
    const parent = byId.get(current.parent)
    if (!parent) break
    chain.unshift(parent.slug)
    current = parent
  }
  return chain
}

// ===============================
// IMPORT
// ===============================

async function importPages() {
  const payload = await getPayload({ config })
  await preloadMediaCache(payload)

  console.log("Fetching all academy pages...")
  const allPages = await fetchAllPages()
  console.log("Total pages:", allPages.length)

  const byId = new Map<number, any>()
  for (const p of allPages) byId.set(p.id, p)

  const childCount = new Map<number, number>()
  for (const p of allPages) {
    if (p.parent) childCount.set(p.parent, (childCount.get(p.parent) || 0) + 1)
  }

  const leafPages = allPages.filter((p) => !childCount.get(p.id) && p.status === 'publish')
  console.log("Leaf pages to consider:", leafPages.length)

  let imported = 0
  let updated = 0
  let skipped = 0
  let failed = 0

  for (const wpPage of leafPages) {
    const title = he.decode(wpPage.title.rendered)
    console.log("\nProcessing:", title, "(" + wpPage.slug + ")")

    let rawHtml: string = wpPage.content.rendered

    if (rawHtml.includes('[vc_') || rawHtml.includes('[/vc_')) {
      console.log("Unrendered shortcode content, scraping live page instead:", wpPage.link)
      try {
        const liveRes = await axios.get(wpPage.link, { timeout: 60000 })
        const $$ = cheerio.load(liveRes.data)
        const entryContent = $$('.entry-content').first()
        if (entryContent.length && entryContent.text().trim().length > 100) {
          rawHtml = entryContent.html() || ''
        } else {
          console.log("Skipped (live page scrape found no content):", wpPage.slug)
          skipped++
          continue
        }
      } catch (error) {
        console.log("Skipped (live page fetch failed):", wpPage.slug, error instanceof Error ? error.message : error)
        skipped++
        continue
      }
    }

    try {
      const linkPath = new URL(wpPage.link).pathname
      const rawUrlPath = linkPath.replace(/^\/academy\//, '').replace(/\/$/, '')
      // A trashed ancestor page has WordPress appending "__trashed" (or "__trashed-2", etc.)
      // to its slug, which leaks into descendants' computed permalinks. Strip it so the
      // stored urlPath matches the real, clean production URL structure.
      const urlPath = rawUrlPath
        .split('/')
        .map((seg) => seg.replace(/__trashed(-\d+)?$/, ''))
        .join('/')
      const ancestorChain = urlPath.split('/').slice(0, -1)

      if (ancestorChain.length === 0) {
        console.log("Skipped (top-level page, no parent category):", wpPage.slug)
        skipped++
        continue
      }

      const topCategorySlug = ancestorChain[0]
      const topCategoryPage = allPages.find(
        (p) => p.slug.replace(/__trashed(-\d+)?$/, '') === topCategorySlug && p.parent === 0,
      )
      const categoryName = topCategoryPage ? he.decode(topCategoryPage.title.rendered) : topCategorySlug

      let blocks = await cleanWordPressContent(rawHtml, payload, title)

      if (blocks.length === 0) {
        console.log("Skipped (no real content):", wpPage.slug)
        skipped++
        continue
      }

      let heroImage: number | null = null
      if (wpPage.featured_media) {
        try {
          const mediaRes = await axios.get(`https://tutorsindia.net/academy/wp-json/wp/v2/media/${wpPage.featured_media}`)
          const imageURL = mediaRes.data.source_url.replace(/["']/g, '').trim()
          const fileName = path.basename(imageURL.split('?')[0])
          heroImage = await getOrUploadMedia(
            fileName,
            async () => {
              const buf = await axios.get(imageURL, { responseType: 'arraybuffer' })
              return Buffer.from(buf.data)
            },
            he.decode(mediaRes.data.alt_text || title),
            he.decode(mediaRes.data.alt_text || title),
            payload,
          )
        } catch (error) {
          console.log("Hero image failed:", error instanceof Error ? error.message : error)
        }
      }

      if (!heroImage) {
        const firstContentImage = blocks.find((b: any) => b.type === 'image')
        if (firstContentImage) heroImage = firstContentImage.id
      }

      const categoryId = await getOrCreateCategory(categoryName, topCategorySlug, payload)

      const content = createLexicalContent(blocks) as any
      const plainExcerpt = he.decode((wpPage.excerpt?.rendered || '').replace(/(<([^>]+)>)/gi, '').trim()).slice(0, 160)

      const data: any = {
        title,
        slug: wpPage.slug,
        source: "academy",
        urlPath,
        heroImage: heroImage || undefined,
        author: "Tutors India Blog",
        categories: [categoryId],
        content,
        seo: {
          metaTitle: title,
          metaDescription: plainExcerpt || title,
        },
        publishing: {
          status: "published",
          publishedAt: wpPage.date,
        },
      }

      const existing = await payload.find({
        collection: 'posts',
        where: { and: [{ source: { equals: 'academy' } }, { urlPath: { equals: urlPath } }] },
      })

      if (existing.docs.length) {
        await withRetry(() => payload.update({
          collection: 'posts',
          id: existing.docs[0].id,
          data,
        }), `update ${urlPath}`)
        updated++
      } else {
        await withRetry(() => payload.create({
          collection: 'posts',
          data,
        }), `create ${urlPath}`)
        imported++
      }

      console.log("Done:", urlPath)

    } catch (error) {
      console.log('FAILED:', wpPage.slug, error instanceof Error ? error.message : error)
      failed++
    }
  }

  console.log('\n======================')
  console.log('Imported:', imported)
  console.log('Updated:', updated)
  console.log('Skipped:', skipped)
  console.log('Failed:', failed)

  process.exit()
}

importPages()

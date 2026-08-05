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

const WP_API = "https://www.tutorsindia.net/blog/wp-json/wp/v2/posts"

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
// CATEGORIES / TAGS
// ===============================

const categoryCache = new Map<number, number>()
const tagCache = new Map<number, number>()

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
    data: {
      name: he.decode(wpTerm.name),
      slug: wpTerm.slug,
    },
  })

  cache.set(wpTerm.id, created.id)
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

  // Elementor page-builder noise: hand-made breadcrumb icon-lists and a
  // "Table of Content" widget with dead #N anchors, plus a heading widget
  // that repeats the post title inside the body. Must run before class
  // attributes are stripped, since these are only identifiable by class.
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
          const altText = $(element).attr('alt') || 'Blog image'
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
// IMPORT POSTS
// ===============================

async function importPosts() {
  const payload = await getPayload({ config })
  await preloadMediaCache(payload)

  let page = 1
  let imported = 0
  let updated = 0
  let failed = 0
  const failedPages: number[] = []
  const failedSlugs: string[] = []

  while (true) {
    console.log(`\nFetching Page ${page}`)

    let posts: any[]

    try {
      const response = await axios.get(`${WP_API}?per_page=10&page=${page}&_embed=true`)
      posts = response.data

      if (!posts.length) {
        console.log("No more posts")
        break
      }
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 400) {
        console.log("No more posts")
        break
      }

      console.log(`Page ${page} failed, retrying once...`)
      try {
        const retry = await axios.get(`${WP_API}?per_page=10&page=${page}&_embed=true`, { timeout: 120000 })
        posts = retry.data
      } catch {
        console.log(`Saving failed page ${page}`)
        failedPages.push(page)
        page++
        continue
      }
    }

    for (const post of posts) {
      console.log('\nProcessing:', post.title.rendered)

      try {
        const authorName = "Tutors India Blog"

        const terms: any[] = (post._embedded?.["wp:term"] || []).flat()
        const wpCategories = terms.filter((t) => t.taxonomy === "category")
        const wpTags = terms.filter((t) => t.taxonomy === "post_tag")

        const categoryIds: number[] = []
        for (const cat of wpCategories) {
          categoryIds.push(await getOrCreateTerm(cat, "categories", payload))
        }

        const tagIds: number[] = []
        for (const tag of wpTags) {
          tagIds.push(await getOrCreateTerm(tag, "tags", payload))
        }

        let heroImage: number | null = null
        const featuredMedia = post._embedded?.["wp:featuredmedia"]?.[0]
        if (featuredMedia?.source_url) {
          try {
            const fileName = path.basename(featuredMedia.source_url.split('?')[0])
            heroImage = await getOrUploadMedia(
              fileName,
              async () => {
                const buf = await axios.get(featuredMedia.source_url, { responseType: 'arraybuffer' })
                return Buffer.from(buf.data)
              },
              he.decode(featuredMedia.title?.rendered || post.title.rendered),
              he.decode(featuredMedia.alt_text || post.title.rendered),
              payload,
            )
          } catch (error) {
            console.log("Hero image failed:", error instanceof Error ? error.message : error)
          }
        }

        let blocks = await cleanWordPressContent(post.content.rendered, payload, he.decode(post.title.rendered))

        if (blocks.length === 0) {
          blocks = [{
            type: 'paragraph',
            children: [{ type: "text", version: 1, detail: 0, format: 0, mode: "normal", style: "", text: he.decode(post.excerpt.rendered.replace(/(<([^>]+)>)/gi, '')) }],
          }]
        }

        if (!heroImage) {
          const firstContentImage = blocks.find((b: any) => b.type === 'image')
          if (firstContentImage) {
            heroImage = firstContentImage.id
            console.log("No featured image, using first content image as hero:", heroImage)
          }
        }

        const content = createLexicalContent(blocks) as any
        const plainExcerpt = he.decode(post.excerpt.rendered.replace(/(<([^>]+)>)/gi, '').trim()).slice(0, 160)
        const keywords = [...wpCategories, ...wpTags].map((t) => he.decode(t.name)).join(", ")

        const data: any = {
          title: he.decode(post.title.rendered),
          slug: post.slug,
          source: "blog",
          heroImage: heroImage || undefined,
          author: authorName,
          categories: categoryIds,
          tags: tagIds,
          content,
          seo: {
            metaTitle: he.decode(post.title.rendered),
            metaDescription: plainExcerpt,
            metaKeywords: keywords,
          },
          publishing: {
            status: "published",
            publishedAt: post.date,
          },
        }

        const existing = await payload.find({
          collection: 'posts',
          where: {
            and: [
              { slug: { equals: post.slug } },
              { source: { equals: 'blog' } },
            ],
          },
        })

        if (existing.docs.length) {
          await withRetry(() => payload.update({
            collection: 'posts',
            id: existing.docs[0].id,
            data,
          }), `update ${post.slug}`)
          updated++
        } else {
          await withRetry(() => payload.create({
            collection: 'posts',
            data,
          }), `create ${post.slug}`)
          imported++
        }

        console.log('Done:', post.slug, '- images:', blocks.filter((b: any) => b.type === 'image').length)

      } catch (error) {
        console.log('FAILED:', post.slug, error instanceof Error ? error.message : error)
        failedSlugs.push(post.slug)
        failed++
      }
    }

    page++
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }

  console.log('\n======================')
  console.log("FAILED PAGES:", failedPages)
  console.log("FAILED SLUGS:", failedSlugs)
  console.log('Imported:', imported)
  console.log('Updated:', updated)
  console.log('Failed:', failed)

  process.exit()
}

importPosts()

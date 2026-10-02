/**
 * Syncs posts.seo.metaTitle and posts.seo.metaDescription with what the
 * original pubrica.com page actually serves (fresh fetch of <title> and
 * <meta name="description">). Matches posts by source + urlPath.
 *
 * Safety: skips non-200 responses, pages that redirected to a different
 * path, and empty values. Dry run unless --execute. Backs up previous seo.
 *
 * Usage:
 *   npx tsx scripts/sync-seo-from-original.ts                    # dry run, all
 *   npx tsx scripts/sync-seo-from-original.ts --limit 5          # dry run, 5
 *   npx tsx scripts/sync-seo-from-original.ts --limit 5 --execute
 *   npx tsx scripts/sync-seo-from-original.ts --execute
 */
import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'
import * as cheerio from 'cheerio'

dotenv.config({ path: path.resolve(process.cwd(), '.env') })
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const SCRATCH =
  'C:\\Users\\user\\AppData\\Local\\Temp\\claude\\C--Users-user-Documents-pub-insights\\83c2d95f-bede-4c9d-b521-5a35da8fcfe1\\scratchpad'
const LOG = path.join(SCRATCH, 'seo_sync.log')

const args = process.argv.slice(2)
const EXECUTE = args.includes('--execute')
const limitIdx = args.indexOf('--limit')
const LIMIT = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : undefined
const idsIdx = args.indexOf('--ids')
const IDS = idsIdx !== -1 ? new Set(args[idsIdx + 1].split(',').map(Number)) : undefined
// Accept redirects when the page moved to a new category (last path segment unchanged)
const FOLLOW = args.includes('--follow-moved')

const ORIGIN = 'https://pubrica.com'
const PREFIX_TO_SOURCE: Record<string, string> = {
  blog: 'blog',
  academy: 'academy',
  insights: 'insights',
  careers: 'career',
  'call-for-papers': 'call-for-papers',
}
const SOURCE_TO_PREFIX: Record<string, string> = {
  blog: 'blog',
  academy: 'academy',
  insights: 'insights',
  career: 'careers',
  'call-for-papers': 'call-for-papers',
}

const log = (m: string) => {
  fs.appendFileSync(LOG, m + '\n')
  console.log(m)
}

async function fetchMeta(url: string) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 30000)
  try {
    const res = await fetch(url, { signal: controller.signal, redirect: 'follow' })
    const html = await res.text()
    const $ = cheerio.load(html)
    const title = $('title').first().text().replace(/\s+/g, ' ').trim()
    const description = ($('meta[name="description"]').attr('content') || '').replace(/\s+/g, ' ').trim()
    return { status: res.status, finalUrl: res.url, title, description }
  } catch (e: any) {
    return { status: 0, finalUrl: url, title: '', description: '', error: String(e?.message || e) }
  } finally {
    clearTimeout(timer)
  }
}

const norm = (u: string) => {
  try {
    return decodeURIComponent(new URL(u).pathname).replace(/\/+$/, '')
  } catch {
    return u
  }
}

const BACKUP = path.join(SCRATCH, 'seo_sync_backup.jsonl')

// An idle pooled connection dropped by the DB pooler emits an unhandled
// 'error' that would otherwise kill the whole run; the pool reconnects itself.
process.on('uncaughtException', (e) => log(`WARN uncaught: ${String((e as any)?.message || e)}`))

async function main() {
  fs.writeFileSync(LOG, '')
  const { getPayload } = await import('payload')
  const payloadConfig = await (await import('../src/payload.config')).default
  const payload = await getPayload({ config: payloadConfig })

  const all = await payload.find({
    collection: 'posts',
    limit: 0,
    pagination: false,
    depth: 0,
    select: { source: true, urlPath: true, slug: true, seo: true },
  })

  let posts = (all.docs as any[]).filter((p) => SOURCE_TO_PREFIX[p.source])
  if (IDS) posts = posts.filter((p) => IDS.has(p.id))
  if (LIMIT) posts = posts.slice(0, LIMIT)
  log(`Mode: ${EXECUTE ? 'LIVE WRITE' : 'DRY RUN'} | posts: ${posts.length}`)

  // Phase 1: fetch originals with limited concurrency
  const fetched = new Map<number, any>()
  let idx = 0
  async function worker() {
    while (true) {
      const i = idx++
      if (i >= posts.length) return
      const p = posts[i]
      const urlPath = p.urlPath || p.slug
      const url = `${ORIGIN}/${SOURCE_TO_PREFIX[p.source]}/${urlPath}/`
      const meta = await fetchMeta(url)
      fetched.set(p.id, { url, ...meta })
      if ((i + 1) % 100 === 0) log(`fetched ${i + 1}/${posts.length}`)
    }
  }
  await Promise.all(Array.from({ length: 6 }, worker))

  // Phase 2: compare + apply
  const backup: any[] = []
  const results: any[] = []
  const counts: Record<string, number> = {}
  const bump = (k: string) => (counts[k] = (counts[k] || 0) + 1)

  for (const p of posts) {
    const f = fetched.get(p.id)
    const seo = p.seo || {}
    if (!f || f.status !== 200) {
      bump('SKIP_non200')
      results.push({ id: p.id, status: 'SKIP_non200', url: f?.url, code: f?.status })
      continue
    }
    const lastSeg = (u: string) => norm(u).split('/').pop()
    const moved = FOLLOW && lastSeg(f.finalUrl) === lastSeg(f.url)
    if (!moved && norm(f.finalUrl) !== norm(f.url)) {
      bump('SKIP_redirected')
      results.push({ id: p.id, status: 'SKIP_redirected', url: f.url, finalUrl: f.finalUrl })
      continue
    }
    const newTitle = f.title
    const newDesc = f.description
    const data: any = { ...seo }
    let changed = false
    if (newTitle && newTitle !== seo.metaTitle) {
      data.metaTitle = newTitle
      changed = true
    }
    if (newDesc && newDesc !== seo.metaDescription) {
      data.metaDescription = newDesc
      changed = true
    }
    if (!changed) {
      bump('ALREADY_MATCH')
      continue
    }
    backup.push({ id: p.id, previousSeo: seo })
    if (EXECUTE) fs.appendFileSync(BACKUP, JSON.stringify({ id: p.id, previousSeo: seo }) + '\n')
    if (!EXECUTE) {
      bump('DRY-RUN')
      results.push({
        id: p.id,
        status: 'DRY-RUN',
        url: f.url,
        oldTitle: seo.metaTitle,
        newTitle,
        oldDesc: seo.metaDescription,
        newDesc,
      })
      continue
    }
    try {
      await payload.update({ collection: 'posts', id: p.id, data: { seo: data } })
      bump('UPDATED')
      results.push({ id: p.id, status: 'UPDATED', url: f.url, newTitle, newDesc })
    } catch (err: any) {
      bump('ERROR')
      results.push({ id: p.id, status: 'ERROR', error: String(err?.message || err) })
    }
  }

  fs.writeFileSync(path.join(SCRATCH, 'seo_sync_backup.json'), JSON.stringify(backup, null, 2))
  fs.writeFileSync(path.join(SCRATCH, 'seo_sync_results.json'), JSON.stringify(results, null, 2))
  log('--- Summary ---')
  log(JSON.stringify(counts, null, 2))
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

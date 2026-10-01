/**
 * Rewrites embedded content links that point to the original live site
 * (pubrica.com / tutorsindia.com) back to internal relative paths, but ONLY
 * when the target actually exists locally (verified against the posts table).
 * Links to sections not hosted in this repo (services, about-us, etc.) are
 * left untouched since there's nothing local to point them at.
 *
 * Safe by default: dry run unless --execute is passed. Writes a backup of
 * every post's original `content` before overwriting it.
 *
 * Usage:
 *   npx tsx scripts/fix-internal-links.ts                 # dry run, all
 *   npx tsx scripts/fix-internal-links.ts --limit 5        # dry run, first 5 affected
 *   npx tsx scripts/fix-internal-links.ts --execute        # LIVE WRITE, all
 */

import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'

dotenv.config({ path: path.resolve(process.cwd(), '.env') })
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const SCRATCH = 'C:\\Users\\user\\AppData\\Local\\Temp\\claude\\C--Users-user-Documents-pub-insights\\83c2d95f-bede-4c9d-b521-5a35da8fcfe1\\scratchpad'

const args = process.argv.slice(2)
const EXECUTE = args.includes('--execute')
const limitIdx = args.indexOf('--limit')
const LIMIT = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : undefined

const URL_PREFIX: Record<string, string> = {
  academy: 'academy',
  blog: 'blog',
  insights: 'insights',
  career: 'careers',
  'call-for-papers': 'call-for-papers',
}

const EXTERNAL_RE = /"url":"(https?:\/\/(?:www\.)?(?:pubrica|tutorsindia)\.com([^"]*))"/g

function normalizePath(p: string) {
  if (!p || p === '/') return '/'
  return p.endsWith('/') ? p : p + '/'
}

async function main() {
  const { getPayload } = await import('payload')
  const configPromise = (await import('../src/payload.config')).default
  const payloadConfig = await configPromise
  const payload = await getPayload({ config: payloadConfig })

  // Build the set of valid local paths from the actual posts table.
  const allPosts = await payload.find({
    collection: 'posts',
    limit: 0,
    pagination: false,
    depth: 0,
    select: { source: true, urlPath: true, slug: true },
  })

  const validPaths = new Set<string>(['/'])
  for (const p of allPosts.docs as any[]) {
    const prefix = URL_PREFIX[p.source]
    if (!prefix) continue
    const urlPath = p.urlPath || p.slug
    if (urlPath) validPaths.add(normalizePath(`/${prefix}/${urlPath}`))
  }
  // Section listing roots that exist even without a matching post.
  ;['/blog/', '/academy/', '/insights/', '/careers/', '/call-for-papers/', '/insights/sample-work/'].forEach((p) =>
    validPaths.add(p),
  )

  console.log(`Valid local paths indexed: ${validPaths.size}`)

  const { Pool } = await import('pg')
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const idRows = await pool.query(
    `SELECT id FROM posts WHERE content::text ILIKE '%pubrica.com%' OR content::text ILIKE '%tutorsindia.com%'`,
  )
  await pool.end()
  const candidateIds: number[] = idRows.rows.map((r: any) => r.id)
  console.log(`Candidate posts: ${candidateIds.length}`)

  const items: any[] = []
  for (const id of candidateIds) {
    const doc = await payload.findByID({ collection: 'posts', id, depth: 0 })
    if (doc) items.push(doc)
  }

  const backup: any[] = []
  const results: any[] = []
  let rewrittenPosts = 0
  let totalReplacements = 0
  let totalLeftExternal = 0

  for (const doc of items) {
    let text = JSON.stringify(doc.content)
    let madeChange = false
    let replacementsInPost = 0
    let leftInPost = 0

    text = text.replace(EXTERNAL_RE, (full, fullUrl, pathAndRest) => {
      let u: URL
      try {
        u = new URL(fullUrl)
      } catch {
        return full
      }
      const pathname = normalizePath(u.pathname)
      if (validPaths.has(pathname)) {
        const relative = pathname + u.search + u.hash
        madeChange = true
        replacementsInPost++
        totalReplacements++
        return `"url":"${relative}"`
      }
      leftInPost++
      totalLeftExternal++
      return full
    })

    if (!madeChange) continue
    if (LIMIT && rewrittenPosts >= LIMIT) break

    rewrittenPosts++
    backup.push({ id: doc.id, previousContent: doc.content })

    if (!EXECUTE) {
      results.push({ id: doc.id, title: doc.title, status: 'DRY-RUN', replaced: replacementsInPost, leftExternal: leftInPost })
      continue
    }

    try {
      const newContent = JSON.parse(text)
      await payload.update({ collection: 'posts', id: doc.id, data: { content: newContent } })
      results.push({ id: doc.id, title: doc.title, status: 'UPDATED', replaced: replacementsInPost, leftExternal: leftInPost })
    } catch (err: any) {
      results.push({ id: doc.id, title: doc.title, status: 'ERROR', error: String(err?.message || err) })
    }

    if (results.length % 50 === 0) {
      console.log(`progress: ${results.length} posts processed`)
    }
  }

  fs.writeFileSync(path.join(SCRATCH, 'link_fix_backup.json'), JSON.stringify(backup, null, 2))
  fs.writeFileSync(path.join(SCRATCH, 'link_fix_results.json'), JSON.stringify(results, null, 2))

  console.log('\n--- Summary ---')
  console.log(`Mode: ${EXECUTE ? 'LIVE WRITE' : 'DRY RUN'}`)
  console.log(`Posts with at least one rewrite: ${rewrittenPosts}`)
  console.log(`Total links rewritten to internal: ${totalReplacements}`)
  console.log(`Total links left external (no local match): ${totalLeftExternal}`)

  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

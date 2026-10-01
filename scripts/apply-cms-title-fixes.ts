/**
 * Updates posts.seo.metaTitle to match reviewed original titles.
 * Reads the filtered clean_fixes.json list and writes via Payload's local API
 * (no remote auth needed — uses this project's own DATABASE_URL).
 *
 * Safe by default: dry run unless --execute is passed. Always writes a backup
 * of the previous metaTitle values before overwriting, so changes can be reverted.
 *
 * Usage:
 *   npx tsx scripts/apply-cms-title-fixes.ts                 # dry run, all
 *   npx tsx scripts/apply-cms-title-fixes.ts --limit 5        # dry run, first 5
 *   npx tsx scripts/apply-cms-title-fixes.ts --limit 5 --execute   # LIVE WRITE, first 5
 *   npx tsx scripts/apply-cms-title-fixes.ts --execute              # LIVE WRITE, all
 */

import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'

dotenv.config({ path: path.resolve(process.cwd(), '.env') })
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const SCRATCH = 'C:\\Users\\user\\AppData\\Local\\Temp\\claude\\C--Users-user-Documents-pub-insights\\83c2d95f-bede-4c9d-b521-5a35da8fcfe1\\scratchpad'
const FIXES_FILE = path.join(SCRATCH, 'clean_fixes.json')

const args = process.argv.slice(2)
const EXECUTE = args.includes('--execute')
const limitIdx = args.indexOf('--limit')
const LIMIT = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : undefined

type Fix = {
  id: number
  source: string
  slug: string
  urlPath: string
  url: string
  currentCmsTitle: string
  targetTitle: string
}

async function main() {
  const { getPayload } = await import('payload')
  const configPromise = (await import('../src/payload.config')).default

  let items: Fix[] = JSON.parse(fs.readFileSync(FIXES_FILE, 'utf8'))
  if (LIMIT) items = items.slice(0, LIMIT)

  console.log(`Mode: ${EXECUTE ? 'LIVE WRITE' : 'DRY RUN (no changes will be made)'}`)
  console.log(`Posts to process: ${items.length}`)

  const payloadConfig = await configPromise
  const payload = await getPayload({ config: payloadConfig })

  const backup: any[] = []
  const results: any[] = []

  for (const item of items) {
    try {
      const doc: any = await payload.findByID({ collection: 'posts', id: item.id, depth: 0 })
      if (!doc) {
        results.push({ id: item.id, status: 'NOT_FOUND' })
        continue
      }

      const currentSeo = doc.seo || {}
      backup.push({ id: item.id, previousSeo: currentSeo })

      if (!EXECUTE) {
        results.push({
          id: item.id,
          status: 'DRY-RUN',
          old: currentSeo.metaTitle,
          new: item.targetTitle,
        })
        continue
      }

      await payload.update({
        collection: 'posts',
        id: item.id,
        data: { seo: { ...currentSeo, metaTitle: item.targetTitle } },
      })

      results.push({
        id: item.id,
        status: 'UPDATED',
        old: currentSeo.metaTitle,
        new: item.targetTitle,
      })
    } catch (err: any) {
      results.push({ id: item.id, status: 'ERROR', error: String(err?.message || err) })
    }

    if (results.length % 100 === 0) {
      console.log(`progress: ${results.length}/${items.length}`)
    }
  }

  fs.writeFileSync(path.join(SCRATCH, 'apply_backup.json'), JSON.stringify(backup, null, 2))
  fs.writeFileSync(path.join(SCRATCH, 'apply_run_results.json'), JSON.stringify(results, null, 2))

  const counts: Record<string, number> = {}
  results.forEach((r) => (counts[r.status] = (counts[r.status] || 0) + 1))
  console.log('\n--- Summary ---')
  console.log(JSON.stringify(counts, null, 2))

  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

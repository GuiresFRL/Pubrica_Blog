/**
 * Rewrites every content link that still points at pubrica.com / tutorsindia.com to a
 * site-relative path, so nothing in the CMS depends on the old WordPress host.
 * Uses external_status.json (target -> final URL after redirects) so redirected links
 * land on their real destination, and vercel_path_status.json to skip any path the
 * deployed site doesn't serve. Dry run unless --execute; backs up changed posts.
 */
import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'

dotenv.config({ path: path.resolve(process.cwd(), '.env') })

const SCRATCH = 'C:/Users/user/AppData/Local/Temp/claude/C--Users-user-Documents-pub-insights/83c2d95f-bede-4c9d-b521-5a35da8fcfe1/scratchpad'
const HOST = /^https?:\/\/(?:www\.)?(?:pubrica|tutorsindia)\.com/i
const key = (u: string) => decodeURI(new URL(u).pathname).replace(/\/+$/, '') || '/'
const slash = (p: string) => p.replace(/\/*$/, '/')

async function main() {
  const EXECUTE = process.argv.includes('--execute')
  const status: any[] = JSON.parse(fs.readFileSync('external_status.json', 'utf8'))
  const vercel: any[] = JSON.parse(fs.readFileSync('vercel_path_status.json', 'utf8'))
  const okPaths = new Set(vercel.filter((v) => v.code === 200).map((v) => v.p))
  const map = new Map<string, string>()
  for (const s of status) map.set(key(s.url), slash(decodeURI(new URL(s.final).pathname)))

  const { getPayload } = await import('payload')
  const payload = await getPayload({ config: await (await import('../src/payload.config')).default })
  const all = await payload.find({ collection: 'posts', limit: 0, pagination: false, depth: 0, select: { content: true, source: true, urlPath: true } })
  // Every post in the CMS is served by the site at /<section>/<urlPath>/
  const PREFIX: Record<string, string> = { blog: 'blog', insights: 'insights', academy: 'academy', career: 'careers', 'call-for-papers': 'call-for-papers', faq: 'faq' }
  for (const d of all.docs as any[]) if (PREFIX[d.source] && d.urlPath) okPaths.add(slash(`/${PREFIX[d.source]}/${d.urlPath}`))

  const stats = { posts: 0, rewritten: 0, kept: 0 }
  const kept = new Map<string, number>()
  const backup: any[] = []
  const queue: { id: number; content: any }[] = []

  const walk = (n: any, local: { changed: boolean }) => {
    if (n.type === 'link' && typeof n.fields?.url === 'string' && HOST.test(n.fields.url)) {
      const u = new URL(n.fields.url)
      let target = map.get(key(n.fields.url)) ?? slash(decodeURI(u.pathname))
      if (!okPaths.has(target) && okPaths.has(target.toLowerCase())) target = target.toLowerCase()
      if (target === '/' || okPaths.has(target)) {
        n.fields.url = encodeURI(target) + (u.hash || '')
        stats.rewritten++
        local.changed = true
      } else {
        stats.kept++
        kept.set(n.fields.url, (kept.get(n.fields.url) || 0) + 1)
      }
    }
    for (const c of n.children || []) walk(c, local)
  }

  for (const d of all.docs as any[]) {
    if (!d.content || !/(pubrica|tutorsindia)\.com/i.test(JSON.stringify(d.content))) continue
    const content = JSON.parse(JSON.stringify(d.content))
    const local = { changed: false }
    walk(content.root, local)
    if (!local.changed) continue
    stats.posts++
    backup.push({ id: d.id, content: d.content })
    queue.push({ id: d.id, content })
  }

  if (EXECUTE) fs.writeFileSync(path.join(SCRATCH, 'relative_links_backup.json'), JSON.stringify(backup))
  // Save several posts at once; each write is a separate post so they can't overwrite each other.
  if (EXECUTE) {
    let i = 0
    await Promise.all(Array.from({ length: 8 }, async () => {
      while (true) {
        const job = queue[i++]
        if (!job) return
        await payload.update({ collection: 'posts', id: job.id, data: { content: job.content } })
      }
    }))
  }
  console.log(EXECUTE ? 'LIVE' : 'DRY RUN', stats)
  console.log('left external:', [...kept])
  process.exit(0)
}
main()

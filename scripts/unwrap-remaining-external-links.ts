/**
 * Last step of removing the dependency on the old WordPress host: any content link that
 * still points at pubrica.com / tutorsindia.com (old category/tag/date archive pages that
 * the site doesn't serve) is replaced by its plain text. Dry run unless --execute.
 */
import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'

dotenv.config({ path: path.resolve(process.cwd(), '.env') })
const HOST = /^https?:\/\/(?:www\.)?(?:pubrica|tutorsindia)\.com/i

const unwrap = (nodes: any[], stats: { n: number }): any[] => {
  const out: any[] = []
  for (const node of nodes || []) {
    if (node.children) node.children = unwrap(node.children, stats)
    if (node.type === 'link' && typeof node.fields?.url === 'string' && HOST.test(node.fields.url)) {
      stats.n++
      out.push(...(node.children || []))
    } else out.push(node)
  }
  return out
}

async function main() {
  const EXECUTE = process.argv.includes('--execute')
  const { getPayload } = await import('payload')
  const payload = await getPayload({ config: await (await import('../src/payload.config')).default })
  const all = await payload.find({ collection: 'posts', limit: 0, pagination: false, depth: 0, select: { content: true } })
  const stats = { n: 0 }; let posts = 0; const backup: any[] = []
  for (const d of all.docs as any[]) {
    if (!d.content?.root || !/"url":\s*"https?:\/\/(www\.)?(pubrica|tutorsindia)\.com/i.test(JSON.stringify(d.content))) continue
    const content = JSON.parse(JSON.stringify(d.content))
    const before = stats.n
    content.root.children = unwrap(content.root.children, stats)
    if (stats.n === before) continue
    posts++; backup.push({ id: d.id, content: d.content })
    if (EXECUTE) await payload.update({ collection: 'posts', id: d.id, data: { content } })
  }
  if (EXECUTE) fs.writeFileSync('C:/Users/user/AppData/Local/Temp/claude/C--Users-user-Documents-pub-insights/83c2d95f-bede-4c9d-b521-5a35da8fcfe1/scratchpad/unwrap_backup.json', JSON.stringify(backup))
  console.log(EXECUTE ? 'LIVE' : 'DRY RUN', { posts, linksUnwrapped: stats.n })
  process.exit(0)
}
main()

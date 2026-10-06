/**
 * Read-only audit part 2: for posts whose live page has no scrapable body container
 * (standard WP posts rendered through a theme template), compare the stored body with
 * the WordPress REST `content.rendered`. Writes missing_content_rest.json.
 */
import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'
import axios from 'axios'
import * as cheerio from 'cheerio'

dotenv.config({ path: path.resolve(process.cwd(), '.env') })

const textOf = (n: any): string => (n.text ?? '') + ' ' + (n.children || []).map(textOf).join(' ')
const imgsOf = (n: any): number => (n.type === 'upload' ? 1 : 0) + (n.children || []).reduce((a: number, c: any) => a + imgsOf(c), 0)
const clean = (s: string) => s.replace(/\s+/g, ' ').trim()
const PREFIX: Record<string, string> = { blog: 'blog', insights: 'insights', academy: 'academy' }

async function get(url: string) {
  for (let a = 0; a < 4; a++) {
    try {
      const r = await axios.get(url, { timeout: 60000, validateStatus: () => true })
      if (r.status !== 429) return r
    } catch {}
    await new Promise((r) => setTimeout(r, 4000 * (a + 1)))
  }
  return null
}

async function main() {
  const prev: any[] = JSON.parse(fs.readFileSync('missing_content_all.json', 'utf8'))
  const ids = new Set(prev.filter((p) => p.skip).map((p) => p.id))
  const { getPayload } = await import('payload')
  const payload = await getPayload({ config: await (await import('../src/payload.config')).default })
  const all = await payload.find({ collection: 'posts', limit: 0, pagination: false, depth: 0, select: { title: true, source: true, urlPath: true, slug: true, content: true } })
  const docs = (all.docs as any[]).filter((d) => ids.has(d.id) && PREFIX[d.source])
  console.log('to audit', docs.length)

  const results: any[] = []
  let i = 0
  await Promise.all(Array.from({ length: 8 }, async () => {
    while (true) {
      const d = docs[i++]; if (!d) return
      const last = (d.urlPath || d.slug).split('/').pop()
      const link = `https://pubrica.com/${PREFIX[d.source]}/${d.urlPath}/`
      let found: any = null
      for (const type of ['posts', 'pages']) {
        const r = await get(`https://pubrica.com/wp-json/wp/v2/${type}?slug=${encodeURIComponent(last)}&_fields=link,content`)
        found = (r?.data as any[] | undefined)?.find?.((x) => x.link === link)
        if (found) break
      }
      if (!found) { results.push({ id: d.id, source: d.source, urlPath: d.urlPath, skip: 'no-rest' }); continue }
      const $ = cheerio.load(found.content.rendered || '')
      $('script,style,svg').remove()
      const orig = clean($.root().text()).length
      const origImgs = $('img').length
      const ours = clean(textOf(d.content?.root || {})).length
      results.push({ id: d.id, source: d.source, urlPath: d.urlPath, title: d.title, origText: orig, ourText: ours, ratio: +(ours / Math.max(orig, 1)).toFixed(2), origImgs, ourImgs: imgsOf(d.content?.root || {}) })
    }
  }))
  fs.writeFileSync('missing_content_rest_all.json', JSON.stringify(results, null, 1))
  const scored = results.filter((r) => r.ratio !== undefined)
  const bad = scored.filter((r) => (r.ratio < 0.85 && r.origText - r.ourText > 150) || r.origImgs - r.ourImgs > 1)
  fs.writeFileSync('missing_content_rest.json', JSON.stringify(bad, null, 1))
  console.log('audited', scored.length, 'no-rest', results.length - scored.length, 'incomplete', bad.length)
  process.exit(0)
}
main()

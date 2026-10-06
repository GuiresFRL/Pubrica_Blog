/**
 * Read-only audit: compares each post's stored body against the live pubrica.com page
 * (text length + image count) and writes the ones that look incomplete to
 * missing_content.json. Does not modify the CMS.
 */
import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'
import axios from 'axios'
import * as cheerio from 'cheerio'

dotenv.config({ path: path.resolve(process.cwd(), '.env') })

const PREFIX: Record<string, string> = { blog: 'blog', insights: 'insights', academy: 'academy', career: 'careers', 'call-for-papers': 'call-for-papers', faq: 'faq' }
const textOf = (n: any): string => (n.text ?? '') + ' ' + (n.children || []).map(textOf).join(' ')
const imgsOf = (n: any): number => (n.type === 'upload' ? 1 : 0) + (n.children || []).reduce((a: number, c: any) => a + imgsOf(c), 0)
const clean = (s: string) => s.replace(/\s+/g, ' ').trim()

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
  const { getPayload } = await import('payload')
  const payload = await getPayload({ config: await (await import('../src/payload.config')).default })
  const all = await payload.find({ collection: 'posts', limit: 0, pagination: false, depth: 0, select: { title: true, source: true, urlPath: true, slug: true, content: true } })
  const docs = (all.docs as any[]).filter((d) => PREFIX[d.source] && (d.urlPath || d.slug))
  console.log('posts to audit:', docs.length)

  const results: any[] = []
  let i = 0
  await Promise.all(Array.from({ length: 8 }, async () => {
    while (true) {
      const n = i++
      const d = docs[n]; if (!d) return
      if (n % 100 === 0) console.log('progress', n)
      const url = `https://pubrica.com/${PREFIX[d.source]}/${d.urlPath || d.slug}/`
      const res = await get(url)
      if (!res || res.status !== 200) { results.push({ id: d.id, source: d.source, urlPath: d.urlPath, skip: res?.status ?? 'err' }); continue }
      const $ = cheerio.load(res.data)
      $('script,style,noscript,svg').remove()
      const cands = [$('.entry-content').first(), $('[data-elementor-type="wp-page"]').first(), $('.elementor-widget-theme-post-content').first()].filter((c) => c.length)
      const best = cands.map((c) => ({ text: clean(c.text()).length, imgs: c.find('img').length })).sort((a, b) => b.text - a.text)[0]
      if (!best) { results.push({ id: d.id, source: d.source, urlPath: d.urlPath, skip: 'no-container' }); continue }
      const ours = clean(textOf(d.content?.root || {})).length
      const oursImgs = imgsOf(d.content?.root || {})
      results.push({ id: d.id, source: d.source, urlPath: d.urlPath, title: d.title, origText: best.text, ourText: ours, ratio: +(ours / Math.max(best.text, 1)).toFixed(2), origImgs: best.imgs, ourImgs: oursImgs })
    }
  }))

  fs.writeFileSync('missing_content_all.json', JSON.stringify(results, null, 1))
  const scored = results.filter((r) => r.ratio !== undefined)
  const bad = scored.filter((r) => r.ratio < 0.85 && r.origText - r.ourText > 150)
  fs.writeFileSync('missing_content.json', JSON.stringify(bad, null, 1))
  const by: any = {}; bad.forEach((b) => (by[b.source] = (by[b.source] || 0) + 1))
  console.log('audited', scored.length, 'skipped', results.length - scored.length, 'incomplete', bad.length, by)
  process.exit(0)
}
main()

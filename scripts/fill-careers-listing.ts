/**
 * The /careers/job-posting/ page on pubrica.com is an Elementor tab widget, so its
 * imported body kept only the tab labels and lost every job link. Rebuild it from the
 * live page: heading + grouped links to the local career posts.
 * Dry run unless --execute.
 */
import path from 'path'
import dotenv from 'dotenv'
import axios from 'axios'
import * as cheerio from 'cheerio'

dotenv.config({ path: path.resolve(process.cwd(), '.env') })

const text = (t: string, format = 0) => ({ type: 'text', version: 1, detail: 0, format, mode: 'normal', style: '', text: t })
const para = (children: any[]) => ({ type: 'paragraph', version: 1, direction: null, format: '', indent: 0, children })
const heading = (tag: string, t: string) => ({ type: 'heading', version: 1, tag, direction: null, format: '', indent: 0, children: [text(t)] })
const link = (url: string, t: string) => ({
  type: 'link', version: 3, direction: 'ltr', format: '', indent: 0,
  fields: { linkType: 'custom', url, newTab: false }, children: [text(t)],
})

async function main() {
  const EXECUTE = process.argv.includes('--execute')
  const { getPayload } = await import('payload')
  const payload = await getPayload({ config: await (await import('../src/payload.config')).default })

  const career = await payload.find({ collection: 'posts', where: { source: { equals: 'career' } }, limit: 0, pagination: false, depth: 0, select: { urlPath: true, id: true } })
  const local = new Set((career.docs as any[]).map((d) => d.urlPath).filter(Boolean))
  const page = (career.docs as any[]).find((d) => d.urlPath === 'job-posting')

  const res = await axios.get('https://pubrica.com/careers/job-posting/')
  const $ = cheerio.load(res.data)
  const root = $('[data-elementor-type="wp-page"]').first()
  const jobs: { title: string; urlPath: string }[] = []
  const seen = new Set<string>()
  root.find('a[href]').each((_, a) => {
    const m = /^https?:\/\/(?:www\.)?pubrica\.com\/careers\/(.+?)\/?$/.exec($(a).attr('href') || '')
    const title = $(a).text().replace(/\s+/g, ' ').trim()
    if (!m || !title || seen.has(m[1]) || m[1] === 'job-posting') return
    seen.add(m[1])
    jobs.push({ title, urlPath: m[1] })
  })

  const missing = jobs.filter((j) => !local.has(j.urlPath))
  const keep = jobs.filter((j) => local.has(j.urlPath))
  console.log(`jobs found: ${jobs.length}, local: ${keep.length}, no local post: ${missing.length}`)
  missing.forEach((j) => console.log('  no local post:', j.urlPath))

  const groups: [string, (j: any) => boolean][] = [
    ['Full time jobs', (j) => !/^freelance/i.test(j.title) && !/intern/i.test(j.title + j.urlPath)],
    ['Freelance openings', (j) => /^freelance/i.test(j.title)],
    ['Internship', (j) => /intern/i.test(j.title + j.urlPath)],
  ]
  const children: any[] = [heading('h1', 'Job positions at Pubrica')]
  for (const [label, test] of groups) {
    const items = keep.filter(test)
    if (!items.length) continue
    children.push(heading('h2', label))
    items.forEach((j) => children.push(para([link(`/careers/${j.urlPath}/`, j.title)])))
  }
  console.log('blocks:', children.length)

  if (EXECUTE && keep.length) {
    const content = { root: { type: 'root', version: 1, direction: null, format: '', indent: 0, children } }
    await payload.update({ collection: 'posts', id: page.id, data: { content } })
    console.log('updated post', page.id)
  }
  process.exit(0)
}
main()

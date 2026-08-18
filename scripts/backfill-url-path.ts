import 'dotenv/config'
import { getPayload } from 'payload'
import config from '../src/payload.config'

async function backfill() {
  const payload = await getPayload({ config })

  const all = await payload.find({
    collection: 'posts',
    limit: 0,
    pagination: false,
    depth: 1,
  })

  console.log('Total posts:', all.totalDocs)

  let updated = 0

  for (const post of all.docs as any[]) {
    let urlPath: string

    if (post.source === 'blog') {
      urlPath = post.slug
    } else {
      const categorySlug = post.categories?.[0]?.slug || 'uncategorized'
      urlPath = `${categorySlug}/${post.slug}`
    }

    if (post.urlPath === urlPath) continue

    await payload.update({
      collection: 'posts',
      id: post.id,
      data: { urlPath },
    })
    updated++
  }

  console.log('Updated:', updated)
  process.exit()
}

backfill()

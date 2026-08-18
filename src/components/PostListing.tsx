import Link from 'next/link'
import { getPayload } from 'payload'
import React from 'react'

import config from '@/payload.config'
import { CategoryFilter } from '@/components/CategoryFilter'
import { getPostUrl } from '@/utilities/getPostUrl'

const PAGE_SIZE = 15

export const PostListing: React.FC<{
  basePath: string
  breadcrumbLabel: string
  description: string
  searchParams: { category?: string; page?: string; q?: string }
  source: 'academy' | 'blog'
  title: string
}> = async ({ basePath, breadcrumbLabel, description, searchParams, source, title }) => {
  const { category, page: pageParam, q } = searchParams
  const page = Number(pageParam) || 1

  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })

  const allCategories = await payload.find({
    collection: 'categories',
    limit: 0,
    pagination: false,
  })

  const allPostsForCounts = await payload.find({
    collection: 'posts',
    where: { source: { equals: source } },
    limit: 0,
    pagination: false,
    depth: 0,
    select: { categories: true },
  })

  const countsByCategory = new Map<number, number>()
  for (const post of allPostsForCounts.docs as any[]) {
    for (const catId of post.categories || []) {
      countsByCategory.set(catId, (countsByCategory.get(catId) || 0) + 1)
    }
  }

  const categoriesWithCounts = (allCategories.docs as any[])
    .map((cat) => ({
      slug: cat.slug,
      name: cat.name,
      id: cat.id,
      count: countsByCategory.get(cat.id) || 0,
    }))
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count)

  const andConditions: any[] = [{ source: { equals: source } }]

  if (category) {
    const selectedCategory = categoriesWithCounts.find((c) => c.slug === category)
    if (selectedCategory) {
      andConditions.push({ categories: { in: [selectedCategory.id] } })
    }
  }

  if (q) {
    andConditions.push({ title: { contains: q } })
  }

  const result = await payload.find({
    collection: 'posts',
    where: { and: andConditions },
    depth: 1,
    limit: PAGE_SIZE,
    page,
    sort: '-publishing.publishedAt',
  })

  const totalPages = result.totalPages || 1

  return (
    <div className="blog-listing">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <span> / </span>
        <span>{breadcrumbLabel}</span>
      </nav>

      <header className="blog-header">
        <h1>{title}</h1>
        <p>{description}</p>
        <p className="blog-count">
          {result.totalDocs} articles · Page {page} of {totalPages}
        </p>
      </header>

      <CategoryFilter
        basePath={basePath}
        categories={categoriesWithCounts}
        totalCount={allPostsForCounts.totalDocs}
      />

      <p className="blog-found">{result.totalDocs} posts found</p>

      <div className="blog-grid">
        {result.docs.map((post: any) => {
          const publishedDate = post.publishing?.publishedAt
            ? new Date(post.publishing.publishedAt).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })
            : null

          const postUrl = getPostUrl(post, source)

          return (
            <article className="blog-card" key={post.id}>
              <Link href={postUrl}>
                {post.heroImage?.url && (
                  <img
                    alt={post.heroImage.altText || post.title}
                    height={post.heroImage.height}
                    src={post.heroImage.url}
                    width={post.heroImage.width}
                  />
                )}
                {post.categories?.[0] && (
                  <span className="blog-card-category">{post.categories[0].name}</span>
                )}
              </Link>

              <div className="blog-card-meta">
                {publishedDate && <span>📅 {publishedDate}</span>}
                {post.author && <span>✍️ {post.author}</span>}
              </div>

              <h2>
                <Link href={postUrl}>{post.title}</Link>
              </h2>

              {post.seo?.metaDescription && (
                <p className="blog-card-excerpt">{post.seo.metaDescription}</p>
              )}

              <Link className="read-more" href={postUrl}>
                Read More →
              </Link>
            </article>
          )
        })}
      </div>

      {totalPages > 1 && (
        <nav className="blog-pagination" aria-label="Pagination">
          {page > 1 && (
            <Link href={`${basePath}/?page=${page - 1}${category ? `&category=${category}` : ''}`}>
              ← Previous
            </Link>
          )}
          <span>
            Page {page} of {totalPages}
          </span>
          {page < totalPages && (
            <Link href={`${basePath}/?page=${page + 1}${category ? `&category=${category}` : ''}`}>
              Next →
            </Link>
          )}
        </nav>
      )}
    </div>
  )
}

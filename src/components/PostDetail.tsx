import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import React from 'react'

import config from '@/payload.config'
import { RichText } from '@/components/RichText'
import { createHeadingIdAssigner, getPlainText } from '@/utilities/slugify'
import { getPostUrl } from '@/utilities/getPostUrl'
import { SearchBox } from '@/components/SearchBox'

async function getPost(urlPath: string, source: 'academy' | 'blog') {
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })

  const result = await payload.find({
    collection: 'posts',
    where: {
      and: [{ urlPath: { equals: urlPath } }, { source: { equals: source } }],
    },
    depth: 2,
    limit: 1,
  })

  return result.docs[0] || null
}

function buildToc(children: any[], assignId: (text: string) => string) {
  const toc: { id: string; text: string; tag: string }[] = []

  for (const node of children || []) {
    if (node.type === 'heading') {
      const text = getPlainText(node.children)
      if (!text) continue

      // Assign an id for every heading (matching RichText's traversal order)
      // so ToC anchors line up with the actual rendered heading ids, even
      // when only a subset of heading levels are listed in the ToC.
      const id = assignId(text)

      if (node.tag === 'h2' || node.tag === 'h3') {
        toc.push({ id, text, tag: node.tag })
      }
    }
  }

  return toc
}

export const PostDetail: React.FC<{
  listLabel: string
  listPath: string
  urlPath: string
  source: 'academy' | 'blog'
}> = async ({ listLabel, listPath, urlPath, source }) => {
  const post: any = await getPost(urlPath, source)

  if (!post) return notFound()

  const headingIdAssigner = createHeadingIdAssigner()
  const toc = buildToc(post.content?.root?.children || [], headingIdAssigner)
  const primaryCategory = post.categories?.[0]

  let relatedPosts: any[] = []
  if (primaryCategory?.id) {
    const payloadConfig = await config
    const payload = await getPayload({ config: payloadConfig })
    const related = await payload.find({
      collection: 'posts',
      where: {
        and: [
          { categories: { in: [primaryCategory.id] } },
          { source: { equals: source } },
          { urlPath: { not_equals: urlPath } },
        ],
      },
      limit: 8,
      depth: 0,
      sort: '-publishing.publishedAt',
    })
    relatedPosts = related.docs
  }

  const publishedDate = post.publishing?.publishedAt
    ? new Date(post.publishing.publishedAt).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null

  return (
    <div className="post-page">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <span> / </span>
        <Link href={listPath}>{listLabel}</Link>
        {primaryCategory && (
          <>
            <span> / </span>
            <span>{primaryCategory.name}</span>
          </>
        )}
      </nav>

      <div className="post-layout">
        <article className="post-main">
          <header className="post-header">
            {post.heroImage?.url && (
              <img
                alt={post.heroImage.altText || post.title}
                className="post-hero-image"
                height={post.heroImage.height}
                src={post.heroImage.url}
                width={post.heroImage.width}
              />
            )}

            <div className="post-meta">
              {publishedDate && <span>📅 {publishedDate}</span>}
              {post.author && <span>✍️ {post.author}</span>}
            </div>

            <h1>{post.title}</h1>
          </header>

          {toc.length > 0 && (
            <nav className="table-of-contents">
              <h2>Table of contents</h2>
              <ul>
                {toc.map((item) => (
                  <li className={item.tag === 'h3' ? 'toc-sub' : undefined} key={item.id}>
                    <a href={`#${item.id}`}>{item.text}</a>
                  </li>
                ))}
              </ul>
            </nav>
          )}

          {post.content && (
            <RichText
              className="post-content"
              data={post.content}
              headingIdAssigner={headingIdAssigner}
            />
          )}
        </article>

        <aside className="post-sidebar">
          <SearchBox basePath={listPath} />

          {primaryCategory && (
            <div className="sidebar-section">
              <h2>{primaryCategory.name}</h2>
              <ul className="sidebar-list">
                {relatedPosts.map((related) => (
                  <li key={related.id}>
                    <Link href={getPostUrl(related, source)}>{related.title}</Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}

export async function getPostMetadata(urlPath: string, source: 'academy' | 'blog'): Promise<Metadata> {
  const post: any = await getPost(urlPath, source)

  if (!post) return {}

  return {
    title: post.seo?.metaTitle || post.title,
    description: post.seo?.metaDescription,
    keywords: post.seo?.metaKeywords,
    alternates: post.seo?.canonicalURL ? { canonical: post.seo.canonicalURL } : undefined,
    robots: { index: false, follow: false },
    openGraph: {
      title: post.seo?.metaTitle || post.title,
      description: post.seo?.metaDescription,
      images: post.heroImage?.url ? [{ url: post.heroImage.url }] : undefined,
    },
  }
}

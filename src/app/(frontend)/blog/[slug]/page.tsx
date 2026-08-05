import type { Metadata } from 'next'
import React from 'react'

import { PostDetail, getPostMetadata } from '@/components/PostDetail'

type Args = {
  params: Promise<{ slug: string }>
}

export default async function BlogPostPage({ params }: Args) {
  const { slug } = await params

  return (
    <PostDetail
      listLabel="Blog"
      listPath="/blog"
      slug={slug}
      source="blog"
    />
  )
}

export async function generateMetadata({ params }: Args): Promise<Metadata> {
  const { slug } = await params
  return getPostMetadata(slug, 'blog')
}

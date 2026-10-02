import type { Metadata } from 'next'
import React from 'react'

import { PostListing } from '@/components/PostListing'

export const metadata: Metadata = {
  title: 'Blog & Academic Resources | Pubrica',
  description:
    'Expert articles on medical writing, systematic reviews, research methodology and publication.',
}

type Args = {
  searchParams: Promise<{ category?: string; page?: string; q?: string }>
}

export default async function BlogPage({ searchParams }: Args) {
  const resolvedSearchParams = await searchParams

  return (
    <PostListing
      basePath="/blog/"
      breadcrumbLabel="Blog"
      description="Expert articles on medical writing, systematic reviews, research methodology and publication."
      searchParams={resolvedSearchParams}
      source="blog"
      title="Blog & Academic Resources"
    />
  )
}

import type { Metadata } from 'next'
import React from 'react'

import { PostListing } from '@/components/PostListing'

export const metadata: Metadata = {
  title: 'Blog & Academic Resources | Tutors India',
  description:
    'Expert guides on dissertation writing, research methodology, referencing and academic success.',
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
      description="Expert guides on dissertation writing, research methodology, referencing and academic success."
      searchParams={resolvedSearchParams}
      source="blog"
      title="Blog & Academic Resources"
    />
  )
}

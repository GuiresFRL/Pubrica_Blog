import type { Metadata } from 'next'
import React from 'react'

import { PostListing } from '@/components/PostListing'

export const metadata: Metadata = {
  title: 'Academy | Tutors India',
  description: 'Guides and resources from the Tutors India Academy.',
}

type Args = {
  searchParams: Promise<{ category?: string; page?: string; q?: string }>
}

export default async function AcademyPage({ searchParams }: Args) {
  const resolvedSearchParams = await searchParams

  return (
    <PostListing
      basePath="/academy/"
      breadcrumbLabel="Academy"
      description="Guides and resources from the Tutors India Academy."
      searchParams={resolvedSearchParams}
      source="academy"
      title="Academy"
    />
  )
}

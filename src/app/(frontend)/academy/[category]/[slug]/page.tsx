import type { Metadata } from 'next'
import React from 'react'

import { PostDetail, getPostMetadata } from '@/components/PostDetail'

type Args = {
  params: Promise<{ category: string; slug: string }>
}

export default async function AcademyPostPage({ params }: Args) {
  const { slug } = await params

  return (
    <PostDetail
      listLabel="Academy"
      listPath="/academy"
      slug={slug}
      source="academy"
    />
  )
}

export async function generateMetadata({ params }: Args): Promise<Metadata> {
  const { slug } = await params
  return getPostMetadata(slug, 'academy')
}

import type { Metadata } from 'next'
import React from 'react'

import { PostDetail, getPostMetadata } from '@/components/PostDetail'

type Args = {
  params: Promise<{ path: string[] }>
}

export default async function AcademyPostPage({ params }: Args) {
  const { path: pathSegments } = await params
  const urlPath = pathSegments.join('/')

  return (
    <PostDetail
      listLabel="Academy"
      listPath="/academy/"
      source="academy"
      urlPath={urlPath}
    />
  )
}

export async function generateMetadata({ params }: Args): Promise<Metadata> {
  const { path: pathSegments } = await params
  const urlPath = pathSegments.join('/')
  return getPostMetadata(urlPath, 'academy')
}

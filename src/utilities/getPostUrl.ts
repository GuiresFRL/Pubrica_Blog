export function getPostUrl(post: any, source: 'academy' | 'blog'): string {
  if (source === 'blog') {
    return `/blog/${post.slug}`
  }

  const categorySlug = post.categories?.[0]?.slug || 'uncategorized'
  return `/academy/${categorySlug}/${post.slug}`
}

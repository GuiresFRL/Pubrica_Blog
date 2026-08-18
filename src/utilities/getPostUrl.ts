export function getPostUrl(post: any, source: 'academy' | 'blog'): string {
  const base = source === 'blog' ? '/blog' : '/academy'
  const urlPath = post.urlPath || post.slug
  return `${base}/${urlPath}/`
}

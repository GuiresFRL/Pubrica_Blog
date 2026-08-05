export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

export function getPlainText(nodes: any[]): string {
  let text = ''
  for (const node of nodes || []) {
    if (node.type === 'text') {
      text += node.text
    } else if (node.children) {
      text += getPlainText(node.children)
    }
  }
  return text
}

export function createHeadingIdAssigner() {
  const counts = new Map<string, number>()

  return (text: string) => {
    const base = slugify(text)
    const n = (counts.get(base) || 0) + 1
    counts.set(base, n)
    return n === 1 ? base : `${base}-${n}`
  }
}

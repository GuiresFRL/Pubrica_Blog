import type { SerializedEditorState } from 'lexical'
import {
  RichText as ConvertRichText,
  type JSXConvertersFunction,
} from '@payloadcms/richtext-lexical/react'
import React from 'react'

import { createHeadingIdAssigner, getPlainText } from '@/utilities/slugify'

const buildJsxConverters = (
  headingIdAssigner: (text: string) => string,
): JSXConvertersFunction => ({ defaultConverters }) => ({
  ...defaultConverters,
  heading: ({ node, nodesToJSX }) => {
    const children = nodesToJSX({ nodes: node.children })
    const NodeTag = node.tag as any
    const text = getPlainText(node.children as any[])
    const id = headingIdAssigner(text)

    return <NodeTag id={id}>{children}</NodeTag>
  },
  upload: ({ node }) => {
    const uploadDoc = node.value as any

    if (typeof uploadDoc !== 'object' || !uploadDoc?.url) {
      return null
    }

    const alt = uploadDoc.altText || uploadDoc.title || ''

    return (
      <span className="rich-text-image">
        <img alt={alt} height={uploadDoc.height} src={uploadDoc.url} width={uploadDoc.width} />
      </span>
    )
  },
})

export const RichText: React.FC<{
  className?: string
  data: SerializedEditorState
  headingIdAssigner?: (text: string) => string
}> = ({ className, data, headingIdAssigner }) => {
  const converters = buildJsxConverters(headingIdAssigner || createHeadingIdAssigner())

  return <ConvertRichText className={className} converters={converters} data={data} />
}

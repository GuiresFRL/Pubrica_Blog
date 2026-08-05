import { lexicalEditor } from '@payloadcms/richtext-lexical'

export const postsEditor = lexicalEditor({
  features: ({ defaultFeatures }) => [
    ...defaultFeatures,
  ],
})
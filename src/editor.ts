import { EXPERIMENTAL_TableFeature, lexicalEditor } from '@payloadcms/richtext-lexical'

export const postsEditor = lexicalEditor({
  features: ({ defaultFeatures }) => [
    ...defaultFeatures,
    // Imported pubrica.com articles contain data tables
    EXPERIMENTAL_TableFeature(),
  ],
})

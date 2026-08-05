import type { Field } from 'payload'

export const seoField: Field = {
  name: 'seo',
  label: 'SEO',
  type: 'group',
  fields: [
    {
      name: 'metaTitle',
      label: 'Meta Title',
      type: 'text',
    },
    {
      name: 'metaDescription',
      label: 'Meta Description',
      type: 'textarea',
    },
    {
      name: 'metaKeywords',
      label: 'Meta Keywords',
      type: 'text',
    },
    {
      name: 'canonicalURL',
      label: 'Canonical URL',
      type: 'text',
    },
    {
      name: 'robots',
      label: 'Robots',
      type: 'select',
      defaultValue: 'index,follow',
      options: [
        {
          label: 'Index, Follow',
          value: 'index,follow',
        },
        {
          label: 'No Index, Follow',
          value: 'noindex,follow',
        },
        {
          label: 'No Index, No Follow',
          value: 'noindex,nofollow',
        },
      ],
    },
  ],
}
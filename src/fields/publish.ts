import type { Field } from 'payload'

export const publishField: Field = {
  name: 'publishing',
  label: 'Publishing',
  type: 'group',
  fields: [
    {
      name: 'status',
      type: 'select',
      defaultValue: 'draft',
      options: [
        {
          label: 'Draft',
          value: 'draft',
        },
        {
          label: 'Published',
          value: 'published',
        },
      ],
    },
    {
      name: 'publishedAt',
      label: 'Published Date',
      type: 'date',
    },
  ],
}
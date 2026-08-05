import type { Field } from 'payload'

export const slugField: Field = {
  name: 'slug',
  label: 'Slug',
  type: 'text',
  required: true,
  unique: true,
  index: true,
  admin: {
    description:
      'Unique URL slug. Preserve the original WordPress slug during migration.',
  },
}
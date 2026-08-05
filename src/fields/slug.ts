import type { TextField } from 'payload'

export const slugField: TextField = {
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
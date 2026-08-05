import type { CollectionConfig } from 'payload'
import { seoField } from '../fields/seo'
import { slugField } from '../fields/slug'

export const Tags: CollectionConfig = {
  slug: 'tags',

  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug'],
  },

  access: {
    read: () => true,
  },

  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },

    slugField,

    {
      name: 'description',
      type: 'textarea',
    },

    seoField,
  ],
}
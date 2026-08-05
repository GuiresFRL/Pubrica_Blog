import type { CollectionConfig } from 'payload'

export const Categories: CollectionConfig = {
  slug: 'categories',

  admin: {
    useAsTitle: 'name',
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

    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
    },

    {
      name: 'description',
      type: 'textarea',
    },

    {
      name: 'image',
      type: 'upload',
      relationTo: 'media',
    },

    {
      type: 'group',
      name: 'seo',
      fields: [
        {
          name: 'metaTitle',
          type: 'text',
        },
        {
          name: 'metaDescription',
          type: 'textarea',
        },
        {
          name: 'metaKeywords',
          type: 'text',
        },
        {
          name: 'canonical',
          type: 'text',
        },
        {
          name: 'index',
          type: 'checkbox',
          defaultValue: true,
        },
      ],
    },
  ],
}
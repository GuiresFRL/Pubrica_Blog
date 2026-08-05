import type { CollectionConfig } from 'payload'

import { postsEditor } from '../editor'
import { slugField } from '../fields/slug'
import { seoField } from '../fields/seo'
import { publishField } from '../fields/publish'

export const Posts: CollectionConfig = {
  slug: 'posts',

  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'source', 'categories', 'heroImage', 'author', 'updatedAt'],
  },

  access: {
    read: () => true,
  },

  indexes: [{ fields: ['source', 'slug'], unique: true }],

  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'source',
      type: 'select',
      defaultValue: 'blog',
      options: [
        { label: 'Blog', value: 'blog' },
        { label: 'Academy', value: 'academy' },
      ],
      admin: {
        position: 'sidebar',
      },
    },
    { ...slugField, unique: false },
    {
      name: 'heroImage',
      label: 'Thumbnail Image',
      type: 'upload',
      relationTo: 'media',
    },
    {
      name: 'author',
      type: 'text',
    },
    {
      name: 'categories',
      type: 'relationship',
      relationTo: 'categories',
      hasMany: true,
    },
    {
      name: 'tags',
      type: 'relationship',
      relationTo: 'tags',
      hasMany: true,
    },
    {
      name: 'content',
      type: 'richText',
      editor: postsEditor,
    },
    seoField,
    publishField,
  ],
}
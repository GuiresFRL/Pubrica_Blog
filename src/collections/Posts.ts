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

  indexes: [
    { fields: ['source', 'slug'], unique: true },
    { fields: ['source', 'urlPath'], unique: true },
  ],

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
        { label: 'Insights', value: 'insights' },
        { label: 'Academy', value: 'academy' },
        { label: 'Career', value: 'career' },
        { label: 'Call for Papers', value: 'call-for-papers' },
        { label: 'FAQ', value: 'faq' },
      ],
      admin: {
        position: 'sidebar',
      },
    },
    { ...slugField, unique: false },
    {
      name: 'jobType',
      label: 'Job Type',
      type: 'select',
      hasMany: true,
      options: [
        { label: 'Full-time', value: 'full-time' },
        { label: 'Freelance', value: 'freelance' },
        { label: 'Internship', value: 'internship' },
      ],
      admin: {
        position: 'sidebar',
        condition: (data) => data.source === 'career',
        description: 'Which career job-board tab(s) this posting appears under.',
      },
    },
    {
      name: 'urlPath',
      label: 'URL Path',
      type: 'text',
      index: true,
      admin: {
        description: 'Full path segment(s) after the source prefix, e.g. "phd-dissertation/engineering-technology/some-article".',
        position: 'sidebar',
      },
    },
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
import type { CollectionConfig } from 'payload'

export const Media: CollectionConfig = {
  slug: 'media',

  access: {
    read: () => true,
  },

  upload: {
    staticDir: 'media',
    mimeTypes: ['image/*', 'application/pdf', 'video/*'],
  },

  admin: {
    useAsTitle: 'title',
  },

  fields: [
    {
      name: 'title',
      label: 'Image Title',
      type: 'text',

    },
    {
      name: 'altText',
      label: 'Alt Text',
      type: 'text',
    
    },
    {
      name: 'caption',
      label: 'Caption',
      type: 'textarea',
    },
    {
      name: 'credit',
      label: 'Image Credit',
      type: 'text',
    },
    {
      name: 'focusKeyword',
      label: 'Focus Keyword',
      type: 'text',
    },
  ],
}

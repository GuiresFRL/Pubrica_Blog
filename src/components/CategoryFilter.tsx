'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import React from 'react'

type Category = {
  slug: string
  name: string
  count: number
}

export const CategoryFilter: React.FC<{
  basePath?: string
  categories: Category[]
  totalCount: number
}> = ({ basePath: rawBasePath = '/blog', categories, totalCount }) => {
  const basePath = rawBasePath.replace(/\/+$/, '')
  const router = useRouter()
  const searchParams = useSearchParams()
  const current = searchParams.get('category') || ''

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value
    if (value) {
      router.push(`${basePath}/?category=${value}`)
    } else {
      router.push(`${basePath}/`)
    }
  }

  return (
    <div className="category-filter">
      <label htmlFor="category-select">Filter by Category:</label>
      <select id="category-select" onChange={handleChange} value={current}>
        <option value="">All Posts ({totalCount})</option>
        {categories.map((cat) => (
          <option key={cat.slug} value={cat.slug}>
            {cat.name} ({cat.count})
          </option>
        ))}
      </select>
    </div>
  )
}

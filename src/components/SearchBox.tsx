'use client'

import { useRouter } from 'next/navigation'
import React, { useState } from 'react'

export const SearchBox: React.FC = () => {
  const router = useRouter()
  const [query, setQuery] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    router.push(`/blog/?q=${encodeURIComponent(query)}`)
  }

  return (
    <form className="sidebar-search" onSubmit={handleSubmit} role="search">
      <input
        aria-label="Search articles"
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search..."
        type="text"
        value={query}
      />
      <button type="submit">Search</button>
    </form>
  )
}

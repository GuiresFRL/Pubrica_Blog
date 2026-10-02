import Link from 'next/link'
import React from 'react'

import './styles.css'

export default function HomePage() {
  return (
    <div className="home">
      <div className="content">
        <h1>Pubrica Insights</h1>
        <p>
          Articles, guides and resources on medical writing, systematic reviews, statistics and
          publication support.
        </p>
        <div className="links">
          <Link className="admin" href="/academy/">
            Academy
          </Link>
          <Link className="docs" href="/blog/">
            Blog
          </Link>
        </div>
      </div>
    </div>
  )
}

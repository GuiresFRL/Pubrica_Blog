import Link from 'next/link'
import React from 'react'

const SITE_URL = 'https://www.tutorsindia.com'

export const Header: React.FC = () => {
  return (
    <header className="site-header">
      <div className="topbar">
        <div className="topbar-contact">
          <a href="tel:+441143520021">+44-1143520021</a>
          <a href="tel:+918754446690">+91 8754446690</a>
          <a href="mailto:info@tutorsindia.com">info@tutorsindia.com</a>
        </div>
        <div className="topbar-social">
          <a aria-label="Facebook" href="https://www.facebook.com/TutorsIndia" rel="noopener noreferrer" target="_blank">
            <FacebookIcon />
          </a>
          <a aria-label="Instagram" href="https://www.instagram.com/tutors_india/" rel="noopener noreferrer" target="_blank">
            <InstagramIcon />
          </a>
          <a aria-label="LinkedIn" href="https://www.linkedin.com/company/tutors-india" rel="noopener noreferrer" target="_blank">
            <LinkedInIcon />
          </a>
          <a aria-label="YouTube" href="https://www.youtube.com/channel/UCM7QdIYgF7vWMhgMZuwyfrg/" rel="noopener noreferrer" target="_blank">
            <YouTubeIcon />
          </a>
        </div>
      </div>

      <div className="mainnav">
        <Link className="site-logo" href="/">
          <span className="site-logo-icon">🎓</span>
          <span className="site-logo-text">Tutors India</span>
        </Link>

        <nav aria-label="Main navigation" className="mainnav-links">
          <a href={`${SITE_URL}/our-services/`}>Our Services</a>
          <a href={`${SITE_URL}/subjects/`}>Subjects</a>
          <a href={`${SITE_URL}/help-guide/`}>Resources</a>
          <a href={`${SITE_URL}/about-us/`}>About Us</a>
          <Link href="/academy/">Academy</Link>
          <Link href="/blog/">Blog</Link>
          <a href={`${SITE_URL}/contact-us/`}>Contact Us</a>
        </nav>

        <div className="mainnav-actions">
          <button aria-label="Search" className="search-button" type="button">
            <SearchIcon />
          </button>
          <a className="pricing-button" href={`${SITE_URL}/pricing/`}>
            Pricing
          </a>
          <a className="order-button" href={`${SITE_URL}/order-now/`}>
            Order Now
          </a>
        </div>
      </div>
    </header>
  )
}

function FacebookIcon() {
  return (
    <svg fill="currentColor" height="16" viewBox="0 0 24 24" width="16">
      <path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.2c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.4 2.9h-2.4v7A10 10 0 0 0 22 12Z" />
    </svg>
  )
}

function InstagramIcon() {
  return (
    <svg fill="none" height="16" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" width="16">
      <rect height="18" rx="5" width="18" x="3" y="3" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" fill="currentColor" r="1" stroke="none" />
    </svg>
  )
}

function LinkedInIcon() {
  return (
    <svg fill="currentColor" height="16" viewBox="0 0 24 24" width="16">
      <path d="M6.94 8.5H3.56V21h3.38V8.5ZM5.25 3a1.96 1.96 0 1 0 0 3.92 1.96 1.96 0 0 0 0-3.92ZM21 21v-6.9c0-3.3-1.76-4.84-4.11-4.84a3.56 3.56 0 0 0-3.22 1.77V8.5H10.3c.05.94 0 12.5 0 12.5h3.37v-6.98c0-.37.03-.75.14-1.02.3-.75.99-1.53 2.14-1.53 1.51 0 2.11 1.15 2.11 2.84V21H21Z" />
    </svg>
  )
}

function YouTubeIcon() {
  return (
    <svg fill="currentColor" height="16" viewBox="0 0 24 24" width="16">
      <path d="M23 12s0-3.4-.43-5a3 3 0 0 0-2.1-2.1C18.9 4.5 12 4.5 12 4.5s-6.9 0-8.47.4A3 3 0 0 0 1.43 7C1 8.6 1 12 1 12s0 3.4.43 5a3 3 0 0 0 2.1 2.1C5.1 19.5 12 19.5 12 19.5s6.9 0 8.47-.4a3 3 0 0 0 2.1-2.1C23 15.4 23 12 23 12Zm-13.5 3.4V8.6L15.8 12l-6.3 3.4Z" />
    </svg>
  )
}

function SearchIcon() {
  return (
    <svg fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeWidth="2" viewBox="0 0 24 24" width="18">
      <circle cx="11" cy="11" r="7" />
      <line x1="21" x2="16.65" y1="21" y2="16.65" />
    </svg>
  )
}

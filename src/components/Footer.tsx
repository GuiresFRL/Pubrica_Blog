import Link from 'next/link'
import React from 'react'

const SITE_URL = 'https://www.tutorsindia.com'

export const Footer: React.FC = () => {
  return (
    <footer className="site-footer">
      <div className="footer-grid">
        <div className="footer-about">
          <Link className="site-logo site-logo-footer" href="/">
            <span className="site-logo-icon">🎓</span>
            <span className="site-logo-text">Tutors India</span>
          </Link>
          <p>
            Tutors India is a pioneer in providing complete academic guidance and direction since
            2001. Trusted by 10,000+ scholars, students &amp; entrepreneurs worldwide.
          </p>

          <div className="footer-office">
            <strong>Sheffield / Manchester, UK</strong>
            <a href="tel:+441143520021">+44-1143520021</a>
            <a href="mailto:info@tutorsindia.com">info@tutorsindia.com</a>
          </div>

          <div className="footer-office">
            <strong>Chennai, India</strong>
            <span>10, Kutty Street, Nungambakkam, Chennai – 600034</span>
            <a href="tel:+918754446690">+91 8754446690</a>
          </div>
        </div>

        <div className="footer-links">
          <h3>Our Services</h3>
          <ul>
            <li><a href={`${SITE_URL}/our-services/masters-dissertation-writing-services/`}>Masters Dissertation</a></li>
            <li><a href={`${SITE_URL}/our-services/phd-dba-dissertation/`}>PhD Dissertation</a></li>
            <li><a href={`${SITE_URL}/our-services/coursework-writing/`}>Coursework Writing</a></li>
            <li><a href={`${SITE_URL}/our-services/editing-services/`}>Editing Services</a></li>
            <li><a href={`${SITE_URL}/our-services/publication-support/`}>Publication Support</a></li>
            <li><a href={`${SITE_URL}/our-services/development/`}>Development</a></li>
          </ul>
        </div>

        <div className="footer-links">
          <h3>Company</h3>
          <ul>
            <li><a href={`${SITE_URL}/about-us/`}>About Us</a></li>
            <li><a href={`${SITE_URL}/our-writers/`}>Our Writers</a></li>
            <li><a href={`${SITE_URL}/our-process/`}>Our Process</a></li>
            <li><a href={`${SITE_URL}/guarantees/`}>Guarantees</a></li>
            <li><a href={`${SITE_URL}/testimonials/`}>Testimonials</a></li>
            <li><a href={`${SITE_URL}/faq/`}>FAQ</a></li>
          </ul>
        </div>

        <div className="footer-links">
          <h3>Support</h3>
          <ul>
            <li><a href={`${SITE_URL}/pricing/`}>Pricing</a></li>
            <li><a href={`${SITE_URL}/order-now/`}>Order Now</a></li>
            <li><a href={`${SITE_URL}/contact-us/`}>Contact Us</a></li>
            <li><a href={`${SITE_URL}/customer-centre/`}>Customer Centre</a></li>
            <li><a href={`${SITE_URL}/ask-an-expert/`}>Ask an Expert</a></li>
            <li><a href={`${SITE_URL}/privacy-policy/`}>Privacy Policy</a></li>
            <li><a href={`${SITE_URL}/terms-and-conditions/`}>Terms &amp; Conditions</a></li>
          </ul>
        </div>

        <div className="footer-social">
          <h3>Follow Us</h3>
          <div className="footer-social-icons">
            <a aria-label="Facebook" href="https://www.facebook.com/TutorsIndia" rel="noopener noreferrer" target="_blank">f</a>
            <a aria-label="Instagram" href="https://www.instagram.com/tutors_india/" rel="noopener noreferrer" target="_blank">i</a>
            <a aria-label="LinkedIn" href="https://www.linkedin.com/company/tutors-india" rel="noopener noreferrer" target="_blank">in</a>
            <a aria-label="YouTube" href="https://www.youtube.com/channel/UCM7QdIYgF7vWMhgMZuwyfrg/" rel="noopener noreferrer" target="_blank">yt</a>
            <a aria-label="X (Twitter)" href="https://twitter.com/TutorsIndia" rel="noopener noreferrer" target="_blank">x</a>
          </div>
        </div>
      </div>

      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} Tutors India. All rights reserved.</span>
        <span className="footer-bottom-links">
          <a href={`${SITE_URL}/privacy-policy/`}>Privacy Policy</a>
          <a href={`${SITE_URL}/terms-and-conditions/`}>Terms &amp; Conditions</a>
          <a href={`${SITE_URL}/compliant-policy/`}>Complaint Policy</a>
        </span>
      </div>
    </footer>
  )
}

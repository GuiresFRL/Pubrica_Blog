import Link from 'next/link'
import React from 'react'

const SITE_URL = 'https://pubrica.com'

export const Footer: React.FC = () => {
  return (
    <footer className="site-footer">
      <div className="footer-grid">
        <div className="footer-about">
          <Link className="site-logo site-logo-footer" href="/">
            <img alt="Pubrica" className="site-logo-img" height={40} src="/pubrica-logo.png" width={125} />
          </Link>
          <p>
            Pubrica provides medical writing, systematic review, statistical analysis and
            publication support services to researchers, clinicians and life-science companies
            worldwide.
          </p>

          <div className="footer-office">
            <strong>Contact</strong>
            <a href="mailto:sales@pubrica.com">sales@pubrica.com</a>
            <a href="tel:+919884350006">+91 9884350006</a>
            <a href="tel:+19725029262">+1-972-502-9262</a>
            <a href="https://wa.me/919884350006" rel="noopener noreferrer" target="_blank">WhatsApp</a>
          </div>
        </div>

        <div className="footer-links">
          <h3>Explore</h3>
          <ul>
            <li><a href={`${SITE_URL}/services/`}>Services</a></li>
            <li><a href={`${SITE_URL}/services/research-services/`}>Research Services</a></li>
            <li><a href={`${SITE_URL}/services/publication-support/`}>Publication Support</a></li>
            <li><a href={`${SITE_URL}/industries/`}>Industries</a></li>
            <li><a href={`${SITE_URL}/insights/`}>Insights</a></li>
            <li><Link href="/academy/">Academy</Link></li>
            <li><Link href="/blog/">Blog</Link></li>
            <li><a href={`${SITE_URL}/call-for-papers/`}>Call for Papers</a></li>
          </ul>
        </div>

        <div className="footer-links">
          <h3>Company</h3>
          <ul>
            <li><a href={`${SITE_URL}/about-us/`}>About Us</a></li>
            <li><a href={`${SITE_URL}/scientific-editor-profile/`}>Meet the Team</a></li>
            <li><a href={`${SITE_URL}/subject-matter-experts/`}>Subject Areas</a></li>
            <li><a href={`${SITE_URL}/testimonial/`}>Testimonials</a></li>
            <li><a href={`${SITE_URL}/careers/`}>Careers</a></li>
            <li><a href={`${SITE_URL}/faq/`}>FAQ</a></li>
          </ul>
        </div>

        <div className="footer-links">
          <h3>Support</h3>
          <ul>
            <li><a href={`${SITE_URL}/contact-us/`}>Contact Us</a></li>
            <li><a href={`${SITE_URL}/cookie-policy/`}>Cookie Policy</a></li>
            <li><a href={`${SITE_URL}/privacy-policy/`}>Privacy Policy</a></li>
            <li><a href={`${SITE_URL}/terms-and-conditions/`}>Terms &amp; Conditions</a></li>
          </ul>
        </div>

        <div className="footer-social">
          <h3>Follow Us</h3>
          <div className="footer-social-icons">
            <a aria-label="Facebook" href="https://www.facebook.com/pubricamedicalwritingservices" rel="noopener noreferrer" target="_blank">f</a>
            <a aria-label="Instagram" href="https://www.instagram.com/pubrica/" rel="noopener noreferrer" target="_blank">i</a>
            <a aria-label="LinkedIn" href="https://www.linkedin.com/company/pubrica-scientific-medical-writing" rel="noopener noreferrer" target="_blank">in</a>
            <a aria-label="YouTube" href="https://www.youtube.com/channel/UCDUT3JFoRJ4RF4lA7ZmdUjA/" rel="noopener noreferrer" target="_blank">yt</a>
            <a aria-label="X (Twitter)" href="https://x.com/Pub_rica" rel="noopener noreferrer" target="_blank">x</a>
          </div>
        </div>
      </div>

      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} Pubrica. All rights reserved.</span>
        <span className="footer-bottom-links">
          <a href={`${SITE_URL}/privacy-policy/`}>Privacy Policy</a>
          <a href={`${SITE_URL}/terms-and-conditions/`}>Terms &amp; Conditions</a>
        </span>
      </div>
    </footer>
  )
}

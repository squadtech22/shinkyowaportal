"use client";

import Link from "next/link";
import { useState } from "react";
import { subscribeNewsletter, type FormResult } from "@/actions/site";
import type { SiteSettings } from "@/lib/data";
import { openContactDialog, telHref } from "@/lib/site";

// Use the same body-type names as the stock catalog.
const FOOTER_MAKES = [
  "Toyota", "Nissan", "Mazda", "Mitsubishi", "Honda", "Suzuki", "Subaru", "Isuzu",
  "Daihatsu", "Mitsuoka", "Lexus", "BMW", "Hino", "Volkswagen", "Mercedes", "Audi",
];

const FOOTER_REGIONS: [string, string[]][] = [
  ["African Continent", ["Kenya", "Tanzania"]],
  ["Caribbean", ["Jamaica", "Bahamas", "Guyana", "Barbados"]],
  ["Europe", ["UK", "Ireland"]],
  ["Asia", ["Pakistan"]],
];

const FOOTER_TYPES: [string, string][] = [
  ["Hatchback", "Hatchback"], ["Sedan", "Sedan"], ["Sports", "Sports"], ["Truck", "Truck"],
  ["Van", "Van"], ["SUV", "SUV"], ["Pickup", "Pickup"], ["Wagon", "Wagon"],
  ["Buses", "Buses"], ["Mini Buses", "Mini Buses"],
];

function NewsletterForm({ mobile = false }: { mobile?: boolean }) {
  const [result, setResult] = useState<FormResult | null>(null);
  const [pending, setPending] = useState(false);
  return (
    <>
      <form
        className={mobile ? "footer-mobile-newsletter-form" : undefined}
        onSubmit={async (e) => {
          e.preventDefault();
          const form = e.currentTarget;
          setPending(true);
          setResult(null);
          try {
            const response = await subscribeNewsletter(new FormData(form));
            setResult(response);
            if (response.ok) form.reset();
          } catch {
            setResult({ ok: false, message: "Could not subscribe. Please try again." });
          } finally {
            setPending(false);
          }
        }}
      >
        <input type="email" name="email" aria-label="Newsletter email" placeholder={mobile ? "Enter Email Address" : "Enter Email"} maxLength={150} required />
        <button aria-label="Subscribe" disabled={pending}>
          <i className="bx bx-send"></i>
        </button>
      </form>
      {result && <p role="status">{result.message}</p>}
    </>
  );
}

function Accordion({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`footer-accordion${open ? " open" : ""}`}>
      <button type="button" className="footer-accordion-header" onClick={() => setOpen((o) => !o)}>
        <span className="footer-accordion-title">
          <i className={`bx ${icon}`}></i> {title}
        </span>
        <i className="bx bx-chevron-down"></i>
      </button>
      <div className="footer-accordion-body">
        <div className="footer-accordion-grid">{children}</div>
      </div>
    </div>
  );
}

export default function Footer({ settings }: { settings: SiteSettings }) {
  const { headOffice, toyamaOffice } = settings;
  const mainPhone = settings.phones[0] ?? "";
  return (
    <footer className="site-footer">
      {/* Desktop footer (>= 1008px). Styled by public/css/footer-desktop.css;
          the mobile accordion footer below takes over on small screens. */}
      <div className="footer-desktop">
        <div className="fd-top">
          <div className="fd-brand">
            <Link href="/" className="fd-logo">
              <img src="/logo.png" alt="Shinkyowa International" />
            </Link>
            <p className="fd-tagline">Japanese used car exporter delivering quality vehicles worldwide.</p>
            <ul className="fd-contact">
              <li>
                <i className="bx bx-map"></i>
                <span>
                  <strong>Head Office</strong>
                  {headOffice.address}, {headOffice.postCode}
                  <br />
                  Tel &amp; Fax: {headOffice.telFax}
                </span>
              </li>
              <li>
                <i className="bx bx-map"></i>
                <span>
                  <strong>Toyama Office</strong>
                  {toyamaOffice.address}, {toyamaOffice.postCode}
                  <br />
                  Tel &amp; Fax: {toyamaOffice.telFax}
                </span>
              </li>
              {settings.phones.length > 0 && (
                <li>
                  <i className="bx bx-phone"></i>
                  <span>
                    {settings.phones.map((p, i) => (
                      <a key={p} href={telHref(p)}>
                        {p}
                        {i < settings.phones.length - 1 ? ", " : ""}
                      </a>
                    ))}
                  </span>
                </li>
              )}
              {settings.email && (
                <li>
                  <i className="bx bx-envelope"></i>
                  <a href={`mailto:${settings.email}`}>{settings.email}</a>
                </li>
              )}
              {settings.officeHours && (
                <li>
                  <i className="bx bx-time-five"></i>
                  <span>{settings.officeHours}</span>
                </li>
              )}
            </ul>
            <div className="fd-social">
              {settings.facebookUrl && (
                <a href={settings.facebookUrl} target="__blank" aria-label="Facebook"><i className="bx bxl-facebook"></i></a>
              )}
              {settings.linkedinUrl && (
                <a href={settings.linkedinUrl} target="__blank" aria-label="LinkedIn"><i className="bx bxl-linkedin"></i></a>
              )}
              {settings.instagramUrl && (
                <a href={settings.instagramUrl} target="__blank" aria-label="Instagram"><i className="bx bxl-instagram"></i></a>
              )}
            </div>
          </div>

          <div className="fd-col">
            <h3>Country Stock</h3>
            {FOOTER_REGIONS.map(([region, list]) => (
              <div key={region} className="fd-region">
                <h4>{region}</h4>
                <ul>
                  {list.map((c) => (
                    <li key={c}><Link href={`/country/${c}`}>{c}</Link></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="fd-col">
            <h3>Used Vehicles</h3>
            <ul className="fd-two-col">
              {FOOTER_MAKES.map((m) => (
                <li key={m}><Link href={`/make/${m}`}>{m}</Link></li>
              ))}
            </ul>
          </div>

          <div className="fd-col">
            <h3>Body Types</h3>
            <ul>
              {FOOTER_TYPES.map(([slug, label]) => (
                <li key={slug}><Link href={`/type/${slug}`}>{label}</Link></li>
              ))}
            </ul>
          </div>

          <div className="fd-col">
            <h3>Other Links</h3>
            <ul>
              <li><Link href="/category/new arrival">Newly Arrived Vehicles</Link></li>
              <li><Link href="/category/discounted">Discounted Vehicles</Link></li>
              <li><Link href="/category/commercial">Commercial Vehicles</Link></li>
              <li><Link href="/sales-and-bank-details">Sales &amp; Bank Details</Link></li>
              <li><Link href="/stock">Vehicles</Link></li>
              <li><Link href="/type/Pickup">Pickup Trucks</Link></li>
            </ul>
            <div className="fd-newsletter">
              <h4>Subscribe Newsletter</h4>
              <p>Get the latest stock and offers in your inbox.</p>
              <NewsletterForm />
            </div>
          </div>
        </div>
        <div className="fd-bottom">
          <p>Japanese Used Cars - Shinkyowa International © Copyright 2026. All rights reserved</p>
          <p>Sitemap · Terms · Privacy Policy · Shipping Schedule · Disclaimer</p>
        </div>
      </div>

      {/* Mobile-only footer: collapsible accordion layout, shown instead of the columns above on small screens */}
      <div className="footer-mobile">
        <div className="footer-mobile-top">
          <img src="/logo.png" alt="Shinkyowa International" className="footer-mobile-logo" />
          <p className="footer-mobile-address">
            Head office, {headOffice.address}
            <br />
            Toyama office, {toyamaOffice.address}
          </p>
          <div className="footer-mobile-info">
            <div className="footer-mobile-info-item">
              <i className="bx bx-map"></i>
              <span>Post Code: {headOffice.postCode}</span>
            </div>
            <div className="footer-mobile-info-item">
              <i className="bx bx-phone"></i>
              <span>Tel: {mainPhone}</span>
            </div>
            <div className="footer-mobile-info-item">
              <i className="bx bx-envelope"></i>
              <span>Email: {settings.email}</span>
            </div>
          </div>
        </div>

        <div className="footer-mobile-help">
          <div className="footer-mobile-help-icon">
            <i className="bx bx-headphone"></i>
          </div>
          <div className="footer-mobile-help-text">
            <strong>Need Help?</strong>
            <span>Our team is here for you</span>
          </div>
        </div>
        <a href={telHref(mainPhone)} className="footer-mobile-call-btn">
          <i className="bx bx-phone-call"></i> {mainPhone}
        </a>

        <div className="footer-mobile-social">
          <strong>Follow Us</strong>
          <div className="footer-mobile-social-icons">
            {settings.facebookUrl && <a href={settings.facebookUrl} target="__blank"><i className="bx bxl-facebook"></i></a>}
            {settings.instagramUrl && <a href={settings.instagramUrl} target="__blank"><i className="bx bxl-instagram"></i></a>}
            {settings.linkedinUrl && <a href={settings.linkedinUrl} target="__blank"><i className="bx bxl-linkedin"></i></a>}
          </div>
        </div>

        <Accordion icon="bx-car" title="Used Vehicles">
          {["Toyota", "Daihatsu", "Nissan", "Mitsuoka", "Mazda", "Lexus", "Mitsubishi", "BMW", "Honda", "Hino", "Suzuki", "Volkswagen", "Subaru", "Mercedes", "Isuzu", "Audi"].map((m) => (
            <Link key={m} href={`/make/${m}`}>{m}</Link>
          ))}
        </Accordion>

        <Accordion icon="bx-grid-alt" title="Other Links">
          <Link href="/category/new arrival">Newly Arrived Vehicles</Link>
          <Link href="/type/Hatchback">Hatchback</Link>
          <Link href="/category/discounted">Discounted Vehicles</Link>
          <Link href="/type/Sedan">Sedan</Link>
          <Link href="/category/commercial">Commercial Vehicles</Link>
          <Link href="/type/Sports">Sports</Link>
          <Link href="/type/Truck">Truck</Link>
          <Link href="/sales-and-bank-details">Sales &amp; Bank Details</Link>
          <Link href="/type/Van">Van</Link>
          <Link href="/type/SUV">SUV</Link>
          <Link href="/type/Pickup">Pickup</Link>
          <Link href="/type/Wagon">Wagon</Link>
          <Link href="/type/Buses">Buses</Link>
          <Link href="/type/Mini Buses">Mini Buses</Link>
        </Accordion>

        <Accordion icon="bx-globe" title="Country Stock">
          {["Kenya", "Guyana", "Tanzania", "Barbados", "Jamaica", "UK", "Bahamas", "Ireland", "Pakistan"].map((c) => (
            <Link key={c} href={`/country/${c}`}>{c}</Link>
          ))}
        </Accordion>

        <Accordion icon="bx-purchase-tag-alt" title="Quick Links">
          <Link href="/">Home</Link>
          <Link href="/sales-and-bank-details">Sales &amp; Bank Details</Link>
          <Link href="/stock">Browse Stock</Link>
          <Link href="/stock">All Vehicles</Link>
          <Link href="/services/shipping">Services</Link>
          <Link href="/type/Pickup">Pickup Trucks</Link>
          <Link href="/about-us/company-profile">Company Profile</Link>
          <a href="#" onClick={(e) => { e.preventDefault(); openContactDialog(); }}>Contact Us</a>
          <Link href="/about-us/why-choose-us">Why Choose Us</Link>
        </Accordion>

        <div className="footer-mobile-newsletter">
          <div className="footer-mobile-newsletter-icon">
            <i className="bx bx-envelope"></i>
          </div>
          <strong>Subscribe to Our Newsletter</strong>
          <span>Get the latest updates and offers.</span>
          <NewsletterForm mobile />
        </div>

        <div className="footer-mobile-bottom">
          <p>Japanese Used Cars - Shinkyowa International © Copyright 2026. All rights reserved.</p>
          <p>Sitemap | Terms | Privacy Policy | Shipping Schedule | Disclaimer</p>
        </div>
      </div>
    </footer>
  );
}

"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import type { SiteSettings } from "@/lib/data";
import { openContactDialog } from "@/lib/site";

// Signed out, this leads to the one sign-in for customers and staff.
const LOGIN_URL = "/login";

export type HeaderAccount = { name: string; role: string; href: string } | null;

function JapanTime() {
  const [time, setTime] = useState("");
  useEffect(() => {
    const update = () =>
      setTime(new Date().toLocaleTimeString("en-US", { timeZone: "Asia/Tokyo", hour12: false }));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);
  return <span id="current-time">{time}</span>;
}

function SearchInput() {
  const search = useSearchParams().get("search") ?? "";
  return (
    <input key={search} type="search" name="search" id="search" placeholder="Search by Make,Mode,Year...." defaultValue={search} />
  );
}

/** "Login/Register", or the signed-in person's name and role (Admin, Manager, Agent, Customer...). */
function AuthLink({ account }: { account: HeaderAccount }) {
  if (!account) {
    return (
      <a href={LOGIN_URL}>
        <p>
          <i className="bx bxs-user"></i> <span>Login</span>
        </p>
      </a>
    );
  }
  return (
    <a href={account.href} title={`Signed in as ${account.name} (${account.role}) — open your dashboard`}>
      <p>
        <i className="bx bxs-user-check"></i>{" "}
        <span>
          {account.name}{" "}
          <small style={{ fontSize: "0.8em", opacity: 0.8 }}>· {account.role}</small>
        </span>
      </p>
    </a>
  );
}

export default function Header({
  total,
  settings,
  account,
}: {
  total: number;
  settings: SiteSettings;
  account: HeaderAccount;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [openSubmenu, setOpenSubmenu] = useState<string | null>(null);
  const [mobileSearch, setMobileSearch] = useState(false);

  // Close the mobile drawer after navigating.
  const [shownPath, setShownPath] = useState(pathname);
  if (shownPath !== pathname) {
    setShownPath(pathname);
    setMenuOpen(false);
    setOpenSubmenu(null);
  }

  const toggleMenu = () => setMenuOpen((o) => !o);
  const toggleSubmenu = (name: string) => setOpenSubmenu((cur) => (cur === name ? null : name));

  const submenu = (name: string, label: string, links: [string, string][]) => (
    <li className={`has-submenu${openSubmenu === name ? " open" : ""}`}>
      <button
        type="button"
        className="submenu-toggle"
        aria-expanded={openSubmenu === name}
        onClick={() => toggleSubmenu(name)}
      >
        {label} <i className="bx bx-chevron-down"></i>
      </button>
      <ul className="submenu">
        {links.map(([href, text]) => (
          <li key={href}>
            <Link href={href}>{text}</Link>
          </li>
        ))}
      </ul>
    </li>
  );

  return (
    <header>
      <div className="upp-header">
        <div className="container flex">
          <div className="info flex">
            <div className="item">
              <p>Email : <span>{settings.email}</span></p>
            </div>
            <div className="item">
              <p>Phone : <span>{settings.phones.join(", ")}</span></p>
            </div>
            <div className="item">
              <p>Total Stock : <span>{total}</span></p>
            </div>
          </div>
          <div className="time">
            <p>Japan Time : <JapanTime /></p>
          </div>
          <div className="socials">
            {settings.facebookUrl && (
              <a href={settings.facebookUrl} target="__blank">
                <i className="bx bxl-facebook"></i>
              </a>
            )}
            {settings.linkedinUrl && (
              <a href={settings.linkedinUrl} target="__blank">
                <i className="bx bxl-linkedin"></i>
              </a>
            )}
            {settings.instagramUrl && (
              <a href={settings.instagramUrl} target="__blank">
                <i className="bx bxl-instagram"></i>
              </a>
            )}
          </div>
        </div>
      </div>
      <div className="main-header">
        <div className="container flex mobile-header-layout">
          <button className="hamburger" onClick={toggleMenu}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="icon">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
          <div className="logo">
            <Link href="/">
              <img src="/logo.png" alt="" />
            </Link>
          </div>
          <div className="search">
            <button className="mobile-search-btn" style={{ display: "none" }} onClick={() => setMobileSearch((s) => !s)}>
              <i className={`bx ${mobileSearch ? "bx-x" : "bx-search"}`}></i>
            </button>
            <form action="/stock-search" method="get" className={`flex${mobileSearch ? " active" : ""}`} id="search-form">
              <Suspense fallback={<input type="search" name="search" id="search" placeholder="Search by Make,Mode,Year...." />}>
                <SearchInput />
              </Suspense>
              <button>
                <i className="bx bx-search"></i>
              </button>
            </form>
          </div>
          <div className="options flex desktop-only-auth">
            <div className="item flex">
              <AuthLink account={account} />
            </div>
          </div>
        </div>
      </div>
      <div className={`menu-overlay${menuOpen ? " active" : ""}`} id="menu-overlay" onClick={toggleMenu}></div>
      <nav>
        <div className="container">
          <ul id="menu" className={menuOpen ? "active" : undefined}>
            <li className="menu-header" style={{ display: "none" }}>
              <img src="/logo.png" alt="Logo" />
              <button className="close-menu" onClick={toggleMenu}>
                <i className="bx bx-x"></i>
              </button>
            </li>
            <li className="mobile-only-auth" style={{ display: "none" }}>
              <AuthLink account={account} />
            </li>
            <li className="mobile-only-info" style={{ display: "none" }}>
              <div className="info-card">
                <div className="info-item">
                  <i className="bx bx-envelope"></i>
                  <div className="info-text">
                    <strong>Email</strong>
                    <span>{settings.email}</span>
                  </div>
                </div>
                <div className="info-item">
                  <i className="bx bx-phone-call"></i>
                  <div className="info-text">
                    <strong>Phone</strong>
                    <span>{settings.phones[0]}</span>
                  </div>
                </div>
                <div className="info-item">
                  <i className="bx bx-car"></i>
                  <div className="info-text">
                    <strong>Total Stock</strong>
                    <span>{total}</span>
                  </div>
                </div>
              </div>
            </li>
            <li><Link href="/">Home</Link></li>
            <li><Link href="/stock">Browse Stock</Link></li>
            {submenu("services", "Services", [["/services/shipping", "Shipping"]])}
            {submenu("about", "About Us", [
              ["/about-us/company-profile", "Company Profile"],
              ["/about-us/why-choose-us", "Why Choose Us"],
            ])}
            <li><Link href="/sales-and-bank-details">Sales &amp; Bank Details</Link></li>
            <li id="contact-us" onClick={openContactDialog}>Contact Us</li>
          </ul>
        </div>
      </nav>
    </header>
  );
}

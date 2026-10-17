"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type DropdownName = "product" | "solutions";

export function SiteNavigation() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<DropdownName | null>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const leaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const closeAll = () => {
    if (leaveTimeoutRef.current) {
      clearTimeout(leaveTimeoutRef.current);
      leaveTimeoutRef.current = null;
    }
    setMenuOpen(false);
    setOpenDropdown(null);
    if (typeof document !== "undefined" && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  };

  // Close menus when route changes
  useEffect(() => {
    closeAll();
  }, [pathname]);

  // Click outside detection to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (
        navRef.current &&
        !navRef.current.contains(event.target as Node) &&
        toggleRef.current &&
        !toggleRef.current.contains(event.target as Node)
      ) {
        closeAll();
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeAll();
        toggleRef.current?.focus();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
      document.removeEventListener("keydown", onKeyDown);
      if (leaveTimeoutRef.current) {
        clearTimeout(leaveTimeoutRef.current);
      }
    };
  }, []);

  const toggleDropdown = (name: DropdownName) => {
    if (leaveTimeoutRef.current) {
      clearTimeout(leaveTimeoutRef.current);
      leaveTimeoutRef.current = null;
    }
    setOpenDropdown((current) => (current === name ? null : name));
  };

  const handleMouseEnter = (name: DropdownName) => {
    if (leaveTimeoutRef.current) {
      clearTimeout(leaveTimeoutRef.current);
      leaveTimeoutRef.current = null;
    }
    // Only apply hover effect on desktop (> 900px viewport)
    if (typeof window !== "undefined" && window.innerWidth > 900) {
      setOpenDropdown(name);
    }
  };

  const handleMouseLeave = () => {
    if (typeof window !== "undefined" && window.innerWidth > 900) {
      if (leaveTimeoutRef.current) {
        clearTimeout(leaveTimeoutRef.current);
      }
      leaveTimeoutRef.current = setTimeout(() => {
        setOpenDropdown(null);
      }, 150);
    }
  };

  return (
    <>
      <button
        ref={toggleRef}
        type="button"
        className="nav-menu-toggle"
        aria-expanded={menuOpen}
        aria-controls="main-navigation"
        onClick={() => setMenuOpen((current) => !current)}
      >
        <span className="sr-only">{menuOpen ? "Close main menu" : "Open main menu"}</span>
        <span className="nav-menu-icon" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
      </button>

      <nav
        ref={navRef}
        id="main-navigation"
        aria-label="Main"
        className={`site-nav${menuOpen ? " is-open" : ""}`}
      >
        {/* Product Dropdown */}
        <div
          className={`nav-dropdown${openDropdown === "product" ? " is-open" : ""}`}
          onMouseEnter={() => handleMouseEnter("product")}
          onMouseLeave={handleMouseLeave}
        >
          <button
            type="button"
            className="nav-dropdown-trigger"
            aria-expanded={openDropdown === "product"}
            aria-controls="product-navigation"
            onClick={() => toggleDropdown("product")}
          >
            <span>Product</span>
            <span className="nav-chevron" aria-hidden="true">⌄</span>
          </button>
          <div id="product-navigation" className="nav-dropdown-panel">
            <Link href="/product" className="dropdown-item" onClick={closeAll}>
              <div className="dropdown-item-icon">🏛️</div>
              <div className="dropdown-item-body">
                <div className="dropdown-item-title">
                  <span>Platform Architecture</span>
                  <span className="status-stamp stamp-review">Core</span>
                </div>
                <div className="dropdown-item-desc">
                  One engine, three deployment modes: Commerce, Business, and unified Hybrid.
                </div>
              </div>
            </Link>
            <Link href="/features" className="dropdown-item" onClick={closeAll}>
              <div className="dropdown-item-icon">🛍️</div>
              <div className="dropdown-item-body">
                <div className="dropdown-item-title">
                  <span>Commerce Platform</span>
                  <span className="status-stamp stamp-paid">Sell</span>
                </div>
                <div className="dropdown-item-desc">
                  Online stores, direct bKash/Nagad checks, COD risk signals, and courier booking.
                </div>
              </div>
            </Link>
            <Link href="/business" className="dropdown-item" onClick={closeAll}>
              <div className="dropdown-item-icon">💼</div>
              <div className="dropdown-item-body">
                <div className="dropdown-item-title">
                  <span>Business Websites</span>
                  <span className="status-stamp stamp-lead">Inquire</span>
                </div>
                <div className="dropdown-item-desc">
                  Company presence, local services, portfolios, menus, and an organized inquiry inbox.
                </div>
              </div>
            </Link>
            <Link href="/business#hybrid" className="dropdown-item" onClick={closeAll}>
              <div className="dropdown-item-icon">⚡</div>
              <div className="dropdown-item-body">
                <div className="dropdown-item-title">
                  <span>Hybrid Websites</span>
                  <span className="status-stamp stamp-review">Both</span>
                </div>
                <div className="dropdown-item-desc">
                  Generate client inquiries and sell products from one brand website.
                </div>
              </div>
            </Link>
          </div>
        </div>

        {/* Solutions Dropdown */}
        <div
          className={`nav-dropdown${openDropdown === "solutions" ? " is-open" : ""}`}
          onMouseEnter={() => handleMouseEnter("solutions")}
          onMouseLeave={handleMouseLeave}
        >
          <button
            type="button"
            className="nav-dropdown-trigger"
            aria-expanded={openDropdown === "solutions"}
            aria-controls="solutions-navigation"
            onClick={() => toggleDropdown("solutions")}
          >
            <span>Solutions</span>
            <span className="nav-chevron" aria-hidden="true">⌄</span>
          </button>
          <div id="solutions-navigation" className="nav-dropdown-panel">
            <Link href="/features" className="dropdown-item" onClick={closeAll}>
              <div className="dropdown-item-icon">💬</div>
              <div className="dropdown-item-body">
                <div className="dropdown-item-title">Facebook &amp; Social Sellers</div>
                <div className="dropdown-item-desc">Bring chat orders into one automated operating desk.</div>
              </div>
            </Link>
            <Link href="/business/company-website" className="dropdown-item" onClick={closeAll}>
              <div className="dropdown-item-icon">🏢</div>
              <div className="dropdown-item-body">
                <div className="dropdown-item-title">Corporate &amp; B2B Firms</div>
                <div className="dropdown-item-desc">Verified corporate trust, team bios, and practice areas.</div>
              </div>
            </Link>
            <Link href="/business/service-websites" className="dropdown-item" onClick={closeAll}>
              <div className="dropdown-item-icon">💼</div>
              <div className="dropdown-item-body">
                <div className="dropdown-item-title">Professional Service Firms</div>
                <div className="dropdown-item-desc">Present services and capture quote or consultation requests.</div>
              </div>
            </Link>
            <Link href="/business/doctor-websites" className="dropdown-item" onClick={closeAll}>
              <div className="dropdown-item-icon">🩺</div>
              <div className="dropdown-item-body">
                <div className="dropdown-item-title">Clinics &amp; Medical Chambers</div>
                <div className="dropdown-item-desc">BMDC facts, chamber schedules, and appointment requests.</div>
              </div>
            </Link>
            <Link href="/business/restaurant-websites" className="dropdown-item" onClick={closeAll}>
              <div className="dropdown-item-icon">🍽️</div>
              <div className="dropdown-item-body">
                <div className="dropdown-item-title">Restaurants &amp; Cafés</div>
                <div className="dropdown-item-desc">Publish QR dining menus, branch locations, and reservations.</div>
              </div>
            </Link>
            <Link href="/business/public-profile-websites" className="dropdown-item" onClick={closeAll}>
              <div className="dropdown-item-icon">👤</div>
              <div className="dropdown-item-body">
                <div className="dropdown-item-title">Public Figures &amp; Leaders</div>
                <div className="dropdown-item-desc">Publish op-eds, press kits, and capture speaking requests.</div>
              </div>
            </Link>
          </div>
        </div>

        <Link href="/templates" onClick={closeAll}>Templates</Link>
        <Link href="/pricing" onClick={closeAll}>Pricing</Link>
        <Link href="/compare" onClick={closeAll}>Compare</Link>
        <Link href="/demo" onClick={closeAll}>Live Demo</Link>
        <Link href="/start" className="btn btn-primary btn-sm" onClick={closeAll}>Start free</Link>
      </nav>
    </>
  );
}

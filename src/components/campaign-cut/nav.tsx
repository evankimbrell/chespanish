"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const NAV_LINKS = [
  { href: "/campaign-cut/example-episode", label: "Example Episode" },
  { href: "/campaign-cut/recording-tips", label: "Recording Tips" },
];

const CTA = { href: "/campaign-cut/start-your-podcast", label: "Create Your Podcast" };

export function CampaignCutNav() {
  const pathname = usePathname();
  // The menu remembers which page it was opened on, so navigating away
  // (menu link, back button) closes it without any effect-driven state.
  const [openedAt, setOpenedAt] = useState<string | null>(null);
  const menuOpen = openedAt === pathname;
  const closeMenu = () => setOpenedAt(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenedAt(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const current = (href: string) => (pathname === href ? "page" : undefined);

  return (
    <header className="cc-nav">
      <div className="cc-nav-inner">
        <Link href="/campaign-cut" className="cc-logo" aria-label="Campaign Cut home">
          <span className="cc-logo-die" aria-hidden="true">
            d20
          </span>
          <span className="cc-logo-name">Campaign Cut</span>
        </Link>
        <div className="cc-nav-spacer" />
        <nav className="cc-nav-links" aria-label="Primary">
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="cc-nav-link" aria-current={current(link.href)}>
              {link.label}
            </Link>
          ))}
          <Link href={CTA.href} className="cc-pill">
            {CTA.label}
          </Link>
        </nav>
        <Link href={CTA.href} className="cc-pill cc-nav-cta">
          {CTA.label}
        </Link>
        <button
          type="button"
          className="cc-nav-burger"
          aria-expanded={menuOpen}
          aria-controls="cc-nav-menu"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          onClick={() => setOpenedAt(menuOpen ? null : pathname)}
        >
          <span className={`cc-burger${menuOpen ? " open" : ""}`} aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        </button>
      </div>
      {menuOpen && (
        <nav id="cc-nav-menu" className="cc-nav-menu" aria-label="Menu">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="cc-nav-link"
              aria-current={current(link.href)}
              onClick={closeMenu}
            >
              {link.label}
            </Link>
          ))}
          <Link href={CTA.href} className="cc-pill" onClick={closeMenu}>
            {CTA.label}
          </Link>
        </nav>
      )}
    </header>
  );
}

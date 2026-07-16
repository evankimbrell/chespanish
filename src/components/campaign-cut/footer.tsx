import Link from "next/link";

export function CampaignCutFooter() {
  return (
    <footer className="cc-footer">
      <div className="cc-footer-inner">
        <Link href="/campaign-cut" className="cc-footer-brand">
          Campaign <em>Cut</em>
        </Link>
        <div className="cc-footer-spacer" />
        <nav className="cc-footer-links" aria-label="Footer">
          <Link href="/campaign-cut" className="cc-footer-link">
            Home
          </Link>
          <Link href="/campaign-cut/example-episode" className="cc-footer-link">
            Example Episode
          </Link>
          <a href="mailto:info@campaigncut.com" className="cc-footer-link">
            info@campaigncut.com
          </a>
        </nav>
      </div>
    </footer>
  );
}

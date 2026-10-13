"use client";

import Link, { useLinkStatus } from "next/link";

// Content of a page link: swaps to a spinner while that page is loading.
function LinkContent({ children }: { children: React.ReactNode }) {
  const { pending } = useLinkStatus();
  return pending ? <span className="page-btn-spinner" aria-label="Loading" /> : <>{children}</>;
}

function PageLink({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="page-btn" aria-label={label}>
      <LinkContent>{children}</LinkContent>
    </Link>
  );
}

// Port of resources/views/vendor/pagination/custom.blade.php. Each page is a
// whole-button link; the old <button><a></a></button> only reacted to clicks
// on the small inner link.
export default function Pagination({
  currentPage,
  lastPage,
  hrefFor,
}: {
  currentPage: number;
  lastPage: number;
  hrefFor: Record<number, string>;
}) {
  if (lastPage <= 1) return null;
  return (
    <nav className="btn" aria-label="Pagination">
      {currentPage > 1 && (
        <PageLink href={hrefFor[currentPage - 1]} label="Previous page">
          <i className="bx bx-chevron-left"></i>
        </PageLink>
      )}
      {Array.from({ length: lastPage }, (_, i) => i + 1).map((p) =>
        p === currentPage ? (
          <span key={p} className="page-btn active" aria-current="page">
            {p}
          </span>
        ) : (
          <PageLink key={p} href={hrefFor[p]} label={`Page ${p}`}>
            {p}
          </PageLink>
        ),
      )}
      {currentPage < lastPage && (
        <PageLink href={hrefFor[currentPage + 1]} label="Next page">
          <i className="bx bx-chevron-right"></i>
        </PageLink>
      )}
    </nav>
  );
}

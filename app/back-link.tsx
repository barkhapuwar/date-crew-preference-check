"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

// Shown on every page except the start page.
export default function BackLink() {
  const path = usePathname();
  if (path === "/") return null;
  return (
    <Link href="/" className="back">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M10 3 5 8l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Back to start
    </Link>
  );
}

import React from 'react';
import clsx from 'clsx';

/**
 * LedgerLite mark — a single-colour monogram drawn in currentColor (white on
 * the dark canvas). The L's stem is cut like a pen nib, its foot runs out as a
 * slanted ledger rule, and a coin rests in the inner corner: a ledger that
 * holds value. No container, so it sits directly on the page.
 */
export const BrandGlyph: React.FC<{ size?: number; className?: string }> = ({ size = 28, className }) => (
  <svg
    viewBox="0 0 32 32"
    width={size}
    height={size}
    fill="currentColor"
    aria-hidden="true"
    className={clsx('shrink-0', className)}
  >
    {/* Stem with a nib-cut top, flowing into a foot that ends in a slanted rule */}
    <path d="M6 8.2 L12 4 V21.5 H24.6 L28 27.5 H6 Z" />
    {/* Coin in the inner corner */}
    <circle cx="19.4" cy="14.6" r="3.1" />
  </svg>
);

export const BrandMark: React.FC<{ size?: number; className?: string; withWord?: boolean }> = ({
  size = 28,
  className,
  withWord = false,
}) => (
  <span className={clsx('inline-flex items-center gap-2.5 select-none', className)}>
    <BrandGlyph size={size} />
    {withWord && <span className="font-semibold tracking-[-0.02em] text-[16px]">LedgerLite</span>}
  </span>
);

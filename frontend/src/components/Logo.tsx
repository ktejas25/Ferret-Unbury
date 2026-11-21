import React from 'react';

export type LogoVariant = 'primary' | 'icon' | 'compact' | 'mono';

export interface LogoProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  variant?: LogoVariant;
  /** Height in pixels or CSS string. If a number is provided, px is assumed. */
  height?: number | string;
  /** Width in pixels or CSS string. (Optional, auto-calculated from aspect ratio if omitted). */
  width?: number | string;
  /** Clear space margin equal to the ferret's ear height. Defaults to true. */
  withClearSpace?: boolean;
  /** Accessible label. Defaults to "Ferret-Unbury". */
  alt?: string;
  /** Mark as decorative (sets aria-hidden="true"). */
  decorative?: boolean;
  /** Optional link target (e.g. "/" or dashboard). */
  href?: string;
  /** Optional custom class name applied to image or wrapper. */
  className?: string;
}

const LOGO_SRC: Record<LogoVariant, string> = {
  primary: '/brand/ferret-unbury-primary.svg',
  icon: '/brand/ferret-unbury-icon.svg',
  compact: '/brand/ferret-unbury-compact.svg',
  mono: '/brand/ferret-unbury-mono.svg',
};

// Aspect ratios (width / height)
const ASPECT_RATIOS: Record<LogoVariant, number> = {
  primary: 600 / 160, // 3.75
  icon: 1,            // 1.00
  compact: 330 / 120, // 2.75
  mono: 600 / 160,    // 3.75
};

export const Logo: React.FC<LogoProps> = ({
  variant = 'primary',
  height = 32,
  width,
  withClearSpace = true,
  alt = 'Ferret-Unbury',
  decorative = false,
  href,
  className = '',
  style,
  ...rest
}) => {
  // Brand rule: "do not display the logo smaller than 24px tall (use the icon version below that size)"
  const numericHeight = typeof height === 'number' ? height : parseInt(String(height), 10);
  const activeVariant: LogoVariant =
    !isNaN(numericHeight) && numericHeight < 24 && variant !== 'icon'
      ? 'icon'
      : variant;

  const resolvedHeight = typeof height === 'number' ? `${height}px` : height;
  const resolvedWidth =
    width !== undefined
      ? typeof width === 'number'
        ? `${width}px`
        : width
      : typeof height === 'number'
      ? `${height * ASPECT_RATIOS[activeVariant]}px`
      : 'auto';

  // Brand rule: "Keep a clear-space margin around the logo equal to the height of the ferret's ear on all sides"
  // Ear height is ~15-20% of mark height.
  const clearSpacePadding = withClearSpace ? 'p-1' : '';

  const imageElement = (
    <img
      src={LOGO_SRC[activeVariant]}
      alt={decorative ? '' : alt}
      aria-hidden={decorative ? 'true' : undefined}
      style={{
        height: resolvedHeight,
        width: resolvedWidth,
        maxHeight: '100%',
        objectFit: 'contain',
        flexShrink: 0,
        ...style,
      }}
      className={`inline-block select-none ${clearSpacePadding} ${className}`}
      loading="eager"
      decoding="async"
      {...rest}
    />
  );

  if (href) {
    return (
      <a
        href={href}
        className="inline-flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 rounded-lg group"
        aria-label={alt}
      >
        {imageElement}
      </a>
    );
  }

  return imageElement;
};

export default Logo;

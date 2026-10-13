import { brand } from "@/content/brand";

export function Wordmark({ className = "" }: { className?: string }) {
  if (brand.logo) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <span className={`logo-badge ${className}`}>
        <img src={brand.logo} alt={brand.displayName} width={294} height={320} />
      </span>
    );
  }
  return (
    <span className={`wordmark ${className}`} aria-label={brand.displayName}>
      <span className="wordmark__small" aria-hidden="true">Dimsum by</span>
      <span className="wordmark__name" aria-hidden="true">Kalili</span>
    </span>
  );
}

export function Arrow({ direction = "right" }: { direction?: "right" | "down" | "up" }) {
  const rotate = { right: 0, down: 90, up: -90 }[direction];
  return (
    <svg className="arrow" width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true" style={{ transform: `rotate(${rotate}deg)` }}>
      <path d="M2 9h13M10 4l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Uap bergaya awan retro, dipakai sebagai aksen kecil. */
export function SteamCurl({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 60 90" fill="none" aria-hidden="true">
      <path
        d="M30 88c-10-10-14-20-6-30 7-9 16-12 14-24-1-8-9-11-14-7-5 4-3 11 3 11"
        stroke="currentColor" strokeWidth="5" strokeLinecap="round"
      />
    </svg>
  );
}

export function ProductImage({ image, alt, sizes, eager = false }: { image: string; alt: string; sizes: string; eager?: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/products/${image}-480.webp`}
      srcSet={`/products/${image}-480.webp 480w, /products/${image}-960.webp 960w`}
      sizes={sizes}
      alt={alt}
      width={960}
      height={960}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
    />
  );
}

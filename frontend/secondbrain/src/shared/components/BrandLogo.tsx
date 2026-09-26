import logoSvg from '@/shared/components/icon/Logo.svg';

type BrandLogoProps = { className?: string };

/** Display the existing logo asset without redrawing or changing its proportions. */
export function BrandLogo({ className = '' }: BrandLogoProps) {
  return (
    <img
      src={logoSvg}
      width={205}
      height={146}
      alt=""
      aria-hidden="true"
      draggable={false}
      className={`shrink-0 object-contain select-none ${className}`}
    />
  );
}

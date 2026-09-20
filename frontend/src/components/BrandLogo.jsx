/**
 * FarmFresh brand logo — uses /farmfresh-logo.png from public/
 */
export default function BrandLogo({
  size = 'md',
  className = '',
  onClick,
  alt = 'FarmFresh',
}) {
  const heights = {
    sm: 'h-8',
    md: 'h-10',
    lg: 'h-14',
    xl: 'h-20',
  };
  const h = heights[size] || heights.md;

  return (
    <img
      src="/farmfresh-logo.png"
      alt={alt}
      onClick={onClick}
      className={`${h} w-auto object-contain ${onClick ? 'cursor-pointer' : ''} ${className}`}
      draggable={false}
    />
  );
}

import Image from "next/image";

/** Brand mark — `public/images/landing/kifinal.png` */
export const APP_LOGO_SRC = "/images/landing/kifinal.png";

type Props = {
  className?: string;
  /** Square logo edge length in CSS pixels */
  size?: number;
  priority?: boolean;
};

export function AppLogo({ className = "", size = 36, priority = false }: Props) {
  return (
    <span
      className={`relative inline-flex shrink-0 overflow-hidden rounded-xl border border-sc-line bg-sc-bg ${className}`}
      style={{ width: size, height: size }}
    >
      <Image
        src={APP_LOGO_SRC}
        alt="Klingbo Study Coach"
        width={size}
        height={size}
        className="object-contain"
        priority={priority}
        sizes={`${size}px`}
      />
    </span>
  );
}

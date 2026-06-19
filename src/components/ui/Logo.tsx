type LogoProps = {
  /** Show wordmark beside the mark */
  showWordmark?: boolean;
  /** Icon size in pixels */
  size?: number;
  className?: string;
};

export default function Logo({ showWordmark = false, size = 36, className = "" }: LogoProps) {
  if (showWordmark) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src="/brand/logo.svg"
        alt="BaseForge"
        className={`h-8 w-auto sm:h-9 ${className}`}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand/logo-mark.svg"
      alt="BaseForge"
      width={size}
      height={size}
      className={`shrink-0 rounded-[22%] ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
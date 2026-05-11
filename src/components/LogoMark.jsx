/**
 * Wordmark icon: letter T (Taska) with a green completion check badge.
 */
export default function LogoMark({ size = 18, className, ...rest }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
      {...rest}
    >
      <path
        fill="white"
        d="M5 4h14v3.2H13.6V21h-3.2V7.2H5V4z"
      />
      <circle cx="17.5" cy="16.8" r="3.5" fill="#22c55e" />
      <path
        d="M15.1 16.8l1.35 1.35 3.6-4.1"
        stroke="white"
        strokeWidth="1.85"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

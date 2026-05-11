/** Sun / moon glyphs for the light–dark theme toggle (shared by Board, Analytics, Timeline, etc.) */

export function SunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 2.5V5.2M12 18.8V21.5M21.5 12H18.8M5.2 12H2.5M18.7 5.3L16.8 7.2M7.2 16.8L5.3 18.7M18.7 18.7L16.8 16.8M7.2 7.2L5.3 5.3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function MoonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M14.6 3.3A9.2 9.2 0 1019.9 18a8.3 8.3 0 01-5.3-14.7z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

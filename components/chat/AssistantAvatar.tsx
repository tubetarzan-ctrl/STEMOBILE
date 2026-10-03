/**
 * "Zara" — StarTech's assistant avatar. Hand-built SVG with layered gradients
 * for a soft 3D look (glossy badge, shaded skin & hair, support headset); the
 * raised hand waves on a loop (CSS in globals.css, paused for reduced motion).
 */
export function AssistantAvatar({ size = 64, waving = true }: { size?: number; waving?: boolean }) {
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} aria-hidden className="st-avatar overflow-visible">
      <defs>
        <radialGradient id="za-bg" cx="35%" cy="28%" r="80%">
          <stop offset="0%" stopColor="#67E8F9" />
          <stop offset="45%" stopColor="#0EA5C4" />
          <stop offset="100%" stopColor="#0B3A47" />
        </radialGradient>
        <radialGradient id="za-skin" cx="42%" cy="38%" r="70%">
          <stop offset="0%" stopColor="#FFE3CF" />
          <stop offset="60%" stopColor="#F2BC97" />
          <stop offset="100%" stopColor="#D9936C" />
        </radialGradient>
        <linearGradient id="za-hair" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#5A3A2C" />
          <stop offset="55%" stopColor="#2E1C15" />
          <stop offset="100%" stopColor="#170D09" />
        </linearGradient>
        <linearGradient id="za-shirt" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#C9D3DE" />
        </linearGradient>
        <radialGradient id="za-gloss" cx="40%" cy="15%" r="60%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity=".55" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>
        <clipPath id="za-clip"><circle cx="60" cy="60" r="54" /></clipPath>
      </defs>

      {/* badge */}
      <circle cx="60" cy="60" r="56" fill="url(#za-bg)" />
      <circle cx="60" cy="60" r="55" fill="none" stroke="#A5F3FC" strokeOpacity=".5" strokeWidth="1.5" />

      <g clipPath="url(#za-clip)">
        {/* hair (back) */}
        <path d="M31 58 Q28 96 40 112 L80 112 Q93 96 89 58 Q88 26 60 25 Q32 26 31 58Z" fill="url(#za-hair)" />
        {/* shoulders + shirt */}
        <path d="M18 124 Q20 93 60 89 Q100 93 102 124Z" fill="url(#za-shirt)" />
        <path d="M48 90 L60 106 L72 90" fill="none" stroke="#0EA5C4" strokeWidth="3" strokeLinejoin="round" />
        <circle cx="60" cy="112" r="2" fill="#0EA5C4" />
        {/* neck */}
        <path d="M52 76 h16 v12 q-8 6 -16 0Z" fill="#E3A47F" />
        {/* ears */}
        <ellipse cx="38.5" cy="60" rx="3.5" ry="5" fill="#E8AB85" />
        <ellipse cx="81.5" cy="60" rx="3.5" ry="5" fill="#E8AB85" />
        {/* face */}
        <ellipse cx="60" cy="58" rx="21" ry="24" fill="url(#za-skin)" />
        <ellipse cx="53" cy="47" rx="7" ry="4" fill="#FFF3E9" opacity=".35" />
        {/* hair (front fringe) */}
        <path d="M38 55 Q37 30 60 29 Q84 30 83 55 Q78 41 65 39 Q58 46 46 46 Q41 49 38 55Z" fill="url(#za-hair)" />
        <path d="M50 33 Q60 30 72 35" fill="none" stroke="#8A5A43" strokeWidth="1.6" strokeLinecap="round" opacity=".8" />
        {/* brows, eyes, glints */}
        <path d="M47 53 Q52 50 56 52.5" fill="none" stroke="#3A241B" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M64 52.5 Q68 50 73 53" fill="none" stroke="#3A241B" strokeWidth="1.8" strokeLinecap="round" />
        <ellipse cx="52" cy="60" rx="3" ry="3.6" fill="#1D1A2B" />
        <ellipse cx="68" cy="60" rx="3" ry="3.6" fill="#1D1A2B" />
        <circle cx="53.1" cy="58.6" r="1.1" fill="#fff" />
        <circle cx="69.1" cy="58.6" r="1.1" fill="#fff" />
        {/* blush + smile */}
        <ellipse cx="46" cy="67" rx="4" ry="2.4" fill="#F28B82" opacity=".45" />
        <ellipse cx="74" cy="67" rx="4" ry="2.4" fill="#F28B82" opacity=".45" />
        <path d="M53 69 Q60 77 67 69 Q60 72 53 69Z" fill="#B4473A" />
        <path d="M55.5 70.3 Q60 72.6 64.5 70.3" fill="none" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" />
        {/* support headset */}
        <path d="M36 57 Q35 24 60 24 Q85 24 84 57" fill="none" stroke="#0F172A" strokeWidth="4" strokeLinecap="round" />
        <rect x="31" y="51" width="9" height="14" rx="4" fill="#0F172A" />
        <rect x="33" y="54" width="4" height="8" rx="2" fill="#22D3EE" />
        <path d="M36 64 Q38 76 50 75" fill="none" stroke="#0F172A" strokeWidth="2.2" strokeLinecap="round" />
        <circle cx="51" cy="75" r="2.6" fill="#22D3EE" />
      </g>

      {/* waving arm (outside the clip so the hand pops out of the badge) */}
      <g className={waving ? "st-wave-arm" : undefined}>
        <path d="M86 112 L97 80" stroke="url(#za-shirt)" strokeWidth="12" strokeLinecap="round" />
        <path d="M86 112 L97 80" stroke="#0EA5C4" strokeWidth="12" strokeLinecap="round" strokeOpacity=".12" />
        <g fill="url(#za-skin)">
          <ellipse cx="99" cy="71" rx="8.5" ry="9.5" />
          <rect x="91.5" y="55" width="4.2" height="14" rx="2.1" />
          <rect x="96" y="52" width="4.2" height="15" rx="2.1" />
          <rect x="100.5" y="53.5" width="4.2" height="14" rx="2.1" />
          <rect x="104.6" y="58" width="3.8" height="12" rx="1.9" />
          <rect x="85" y="66" width="10" height="4.2" rx="2.1" transform="rotate(-28 90 68)" />
        </g>
      </g>

      {/* glossy highlight */}
      <ellipse cx="50" cy="26" rx="30" ry="14" fill="url(#za-gloss)" />
    </svg>
  );
}

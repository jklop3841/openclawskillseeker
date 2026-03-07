export function ExoskeletonMascot() {
  return (
    <svg className="mascot" viewBox="0 0 460 560" role="img" aria-label="OpenClaw机械外骨骼 mascot">
      <defs>
        <linearGradient id="armor" x1="0%" x2="100%" y1="0%" y2="100%">
          <stop offset="0%" stopColor="#f4f7fb" />
          <stop offset="55%" stopColor="#9aa8b8" />
          <stop offset="100%" stopColor="#546274" />
        </linearGradient>
        <linearGradient id="shell" x1="0%" x2="0%" y1="0%" y2="100%">
          <stop offset="0%" stopColor="#ff6b5f" />
          <stop offset="100%" stopColor="#c91f2e" />
        </linearGradient>
        <radialGradient id="core" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#92f8ff" />
          <stop offset="100%" stopColor="#1da9d9" />
        </radialGradient>
      </defs>

      <ellipse cx="232" cy="520" rx="132" ry="20" fill="rgba(8, 15, 27, 0.25)" />

      <g>
        <rect x="174" y="98" width="108" height="146" rx="42" fill="url(#shell)" />
        <rect x="136" y="150" width="56" height="138" rx="28" fill="url(#armor)" />
        <rect x="272" y="150" width="56" height="138" rx="28" fill="url(#armor)" />
        <rect x="114" y="276" width="48" height="106" rx="22" fill="#cf2c38" />
        <rect x="302" y="276" width="48" height="106" rx="22" fill="#cf2c38" />
        <circle cx="143" cy="218" r="26" fill="url(#core)" />
        <circle cx="319" cy="218" r="26" fill="url(#core)" />
        <path d="M116 326c-18 14-28 28-28 44 0 20 14 34 34 34 10 0 18-2 28-8l8-34-42-10z" fill="#d42634" />
        <path d="M344 326c18 14 28 28 28 44 0 20-14 34-34 34-10 0-18-2-28-8l-8-34 42-10z" fill="#d42634" />
      </g>

      <g>
        <rect x="154" y="228" width="156" height="188" rx="68" fill="url(#armor)" />
        <rect x="184" y="254" width="96" height="162" rx="44" fill="url(#shell)" />
        <rect x="200" y="318" width="64" height="18" rx="9" fill="#ff8f81" opacity="0.85" />
        <rect x="194" y="348" width="76" height="18" rx="9" fill="#ff8f81" opacity="0.85" />
        <rect x="188" y="378" width="88" height="18" rx="9" fill="#ff8f81" opacity="0.85" />
        <rect x="176" y="276" width="112" height="32" rx="14" fill="#4c5c6e" />
        <rect x="192" y="282" width="80" height="20" rx="10" fill="url(#core)" />
      </g>

      <g>
        <rect x="164" y="412" width="40" height="92" rx="18" fill="url(#armor)" />
        <rect x="256" y="412" width="40" height="92" rx="18" fill="url(#armor)" />
        <rect x="144" y="486" width="62" height="22" rx="11" fill="#28384a" />
        <rect x="254" y="486" width="62" height="22" rx="11" fill="#28384a" />
      </g>

      <g>
        <ellipse cx="228" cy="96" rx="76" ry="70" fill="url(#shell)" />
        <ellipse cx="201" cy="92" rx="10" ry="13" fill="#09111e" />
        <ellipse cx="255" cy="92" rx="10" ry="13" fill="#09111e" />
        <path d="M199 126c20 14 38 14 58 0" fill="none" stroke="#77111e" strokeWidth="8" strokeLinecap="round" />
        <path d="M184 26c-20-28-18-52 5-72" fill="none" stroke="#ff5f58" strokeWidth="8" strokeLinecap="round" />
        <path d="M270 24c22-26 24-52 4-74" fill="none" stroke="#ff5f58" strokeWidth="8" strokeLinecap="round" />
        <circle cx="184" cy="36" r="6" fill="#ffb3aa" />
        <circle cx="272" cy="34" r="6" fill="#ffb3aa" />
      </g>
    </svg>
  );
}

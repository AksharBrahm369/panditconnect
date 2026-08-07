"use client";

import { useState } from "react";

function initials(name: string) {
  return name.trim().split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase() || "P";
}

export function PanditAvatar({ panditId, name, className }: { panditId: string; name: string; className: string }) {
  const [failed, setFailed] = useState(false);

  return <span className={`${className} pandit-photo`} aria-label={`${name}'s verified profile photograph`}>
    <span className="pandit-photo-fallback" aria-hidden="true">{initials(name)}</span>
    {!failed && <img
      src={`/api/pandits/${encodeURIComponent(panditId)}/photo`}
      alt={`${name}, verified Pandit`}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />}
  </span>;
}

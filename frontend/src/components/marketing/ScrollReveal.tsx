"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export function ScrollReveal({
  children,
  className = "",
  delayClass = "",
}: {
  children: ReactNode;
  className?: string;
  /** Optional delay via `delay-100` etc. on inner wrapper */
  delayClass?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) setVisible(true);
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={ref} className={className}>
      <div className={`sc-reveal ${visible ? "sc-reveal-visible" : ""} ${delayClass}`}>{children}</div>
    </div>
  );
}

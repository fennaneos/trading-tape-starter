import React, { useState, useRef, useEffect } from "react";
import styles from "./helpHint.module.css";

/**
 * Small (?) bubble that shows an explanatory tooltip on hover (desktop)
 * and on tap (mobile). Click outside or blur to hide.
 *
 * Usage:
 *   <HelpHint text="Shows volume bars under the price chart." />
 */
export default function HelpHint({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);

  // close on outside click (mobile/desktop)
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  return (
    <span
      ref={rootRef}
      className={styles.wrap}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onClick={() => setOpen(v => !v)} // tap to toggle on mobile
      role="button"
      tabIndex={0}
      aria-label="help"
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setOpen(v => !v)}
    >
      <span className={styles.bubble}>?</span>
      {open && <span className={styles.tooltip}>{text}</span>}
    </span>
  );
}

import React, { useState } from "react";

export default function HelpTip({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <span
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        marginLeft: 6,
        cursor: "help",
      }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onClick={() => setOpen((v) => !v)} // mobile tap toggle
    >
      <span
        style={{
          width: 18,
          height: 18,
          borderRadius: "50%",
          background: "linear-gradient(145deg, #ffd700, #c9a100)",
          color: "#0b0f14",
          fontWeight: 700,
          fontSize: 12,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 1px 4px rgba(212,175,55,0.4)",
          border: "1px solid rgba(212,175,55,0.3)",
          userSelect: "none",
        }}
      >
        ?
      </span>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "26px",
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(10,10,10,0.95)",
            color: "#e7e7e7",
            border: "1px solid rgba(212,175,55,0.4)",
            borderRadius: 10,
            boxShadow: "0 6px 24px rgba(0,0,0,0.45)",
            padding: "8px 12px",
            fontSize: 12,
            zIndex: 50,
            maxWidth: 260,
            lineHeight: 1.35,
            whiteSpace: "normal",
          }}
        >
          <strong style={{ color: "#ffd700" }}>{title}</strong>
          <br />
          {body}
        </div>
      )}
    </span>
  );
}

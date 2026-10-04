"use client";
import { useState } from "react";
import { useStore } from "@/lib/store";

// Clears everything recorded in this browser session (sent profiles, rejections, learned preferences).
export default function ResetButton({ onReset }: { onReset?: () => void }) {
  const { reset } = useStore();
  const [done, setDone] = useState(false);
  return (
    <span className="row-gap">
      <button
        className="btn"
        onClick={() => {
          reset();
          onReset?.();
          setDone(true);
          setTimeout(() => setDone(false), 2500);
        }}
      >
        Reset demo
      </button>
      {done && <span className="small muted" role="status">Demo reset.</span>}
    </span>
  );
}

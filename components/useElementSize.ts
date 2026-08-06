"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Caption sizing is expressed as a percentage of video height so it survives
 * any resolution — which means the preview has to know its own pixel height.
 */
export function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      if (box) setSize({ width: box.width, height: box.height });
    });

    observer.observe(node);
    setSize({ width: node.clientWidth, height: node.clientHeight });

    return () => observer.disconnect();
  }, []);

  return { ref, ...size };
}

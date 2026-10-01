"use client";

import { forwardRef, useLayoutEffect, useRef, type InputHTMLAttributes } from "react";

type AutoscaleAmountInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "value"> & { value: string };

/** Measured large-number entry, following Skiper 105's responsive input pattern. */
export const AutoscaleAmountInput = forwardRef<HTMLInputElement, AutoscaleAmountInputProps>(function AutoscaleAmountInput({ value, placeholder = "0", className = "", ...props }, ref) {
  const container = useRef<HTMLDivElement>(null);
  const measure = useRef<HTMLSpanElement>(null);
  const input = useRef<HTMLInputElement | null>(null);

  useLayoutEffect(() => {
    const outer = container.current;
    const ruler = measure.current;
    const field = input.current;
    if (!outer || !ruler || !field) return;
    let active = true;
    const fit = () => {
      if (!active || outer.clientWidth === 0) return;
      const maximum = parseFloat(getComputedStyle(ruler).fontSize);
      const available = Math.max(0, outer.clientWidth - 32);
      const measured = ruler.getBoundingClientRect().width;
      const fontSize = Math.max(24, Math.min(maximum, maximum * available / Math.max(1, measured)));
      field.style.setProperty("--amount-font-size", `${fontSize}px`);
      field.style.width = `${Math.min(outer.clientWidth, Math.max(44, measured * fontSize / maximum + 32))}px`;
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(outer);
    observer.observe(ruler);
    void document.fonts.ready.then(fit);
    document.fonts.addEventListener("loadingdone", fit);
    return () => {
      active = false;
      observer.disconnect();
      document.fonts.removeEventListener("loadingdone", fit);
    };
  }, [value, placeholder]);

  return (
    <div className="amount-hero-sizer" ref={container}>
      <span className="amount-hero-measure" ref={measure} aria-hidden="true">{value || placeholder}</span>
      <input
        {...props}
        ref={node => {
          input.current = node;
          if (typeof ref === "function") ref(node);
          else if (ref) ref.current = node;
        }}
        value={value}
        placeholder={placeholder}
        className={`amount-hero-input ${className}`.trim()}
        size={1}
      />
    </div>
  );
});

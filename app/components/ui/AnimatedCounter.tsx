"use client";

import { memo, useEffect, useRef, type CSSProperties } from "react";
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";

const WHEEL = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0];
const LINE_HEIGHT = 1.2;

type AnimatedCounterProps = {
  value: number;
  duration?: number;
  separator?: string;
  style?: CSSProperties;
  animateOnMount?: boolean;
};

function DigitWheel({ digit, direction, duration, animateOnMount }: { digit: number; direction: 1 | -1; duration: number; animateOnMount: boolean }) {
  const reducedMotion = useReducedMotion();
  const position = useMotionValue(animateOnMount ? 0 : digit);
  const target = useRef(animateOnMount ? 0 : digit);

  useEffect(() => {
    if (reducedMotion) {
      target.current = digit;
      position.set(digit);
      return;
    }

    const current = position.get();
    const forward = ((digit - current) % 10 + 10) % 10;
    const backward = ((current - digit) % 10 + 10) % 10;
    target.current = direction > 0 ? current + forward : current - backward;
    const controls = animate(position, target.current, {
      type: "spring",
      visualDuration: duration,
      bounce: 0.12,
    });
    return () => controls.stop();
  }, [digit, direction, duration, position, reducedMotion]);

  const y = useTransform(position, value => `${-((((value % 10) + 10) % 10) * 100) / WHEEL.length}%`);

  return (
    <span style={digitViewportStyle} aria-hidden="true">
      <span style={digitSizerStyle}>8</span>
      <motion.span style={{ ...digitStackStyle, y }}>
        {WHEEL.map((face, index) => <span key={index} style={digitFaceStyle}>{face}</span>)}
      </motion.span>
    </span>
  );
}

const MemoDigitWheel = memo(DigitWheel);

export function AnimatedCounter({ value, duration = 0.34, separator = ".", style, animateOnMount = false }: AnimatedCounterProps) {
  const rounded = Math.round(Number.isFinite(value) ? value : 0);
  const previous = useRef(rounded);
  const direction: 1 | -1 = rounded >= previous.current ? 1 : -1;
  previous.current = rounded;
  const magnitude = String(Math.abs(rounded)).replace(/\B(?=(\d{3})+(?!\d))/g, separator);
  const formatted = rounded < 0 ? `−${magnitude}` : magnitude;
  let digitPosition = formatted.replace(/\D/g, "").length;

  return (
    <span style={{ ...counterStyle, ...style }} aria-label={formatted}>
      <span style={srOnlyStyle}>{formatted}</span>
      <span style={counterVisualStyle} aria-hidden="true">
        {[...formatted].map((character, index) => {
          if (!/\d/.test(character)) return <span key={`mark-${index}`} style={markStyle}>{character}</span>;
          const key = digitPosition--;
          return <MemoDigitWheel key={key} digit={Number(character)} direction={direction} duration={duration} animateOnMount={animateOnMount} />;
        })}
      </span>
    </span>
  );
}

const counterStyle: CSSProperties = { display: "inline-flex", alignItems: "center", fontVariantNumeric: "tabular-nums" };
const counterVisualStyle: CSSProperties = { display: "inline-flex", alignItems: "center", userSelect: "none" };
const digitViewportStyle: CSSProperties = {
  position: "relative",
  display: "inline-grid",
  height: `${LINE_HEIGHT}em`,
  lineHeight: LINE_HEIGHT,
  overflow: "hidden",
  maskImage: "linear-gradient(to bottom, transparent 0%, #000 20%, #000 80%, transparent 100%)",
  WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, #000 20%, #000 80%, transparent 100%)",
};
const digitSizerStyle: CSSProperties = { gridArea: "1 / 1", visibility: "hidden" };
const digitStackStyle: CSSProperties = { position: "absolute", insetInline: 0, top: 0 };
const digitFaceStyle: CSSProperties = { height: `${LINE_HEIGHT}em`, display: "flex", alignItems: "center", justifyContent: "center" };
const markStyle: CSSProperties = { display: "inline-block" };
const srOnlyStyle: CSSProperties = { position: "absolute", width: 1, height: 1, padding: 0, margin: -1, overflow: "hidden", clip: "rect(0, 0, 0, 0)", whiteSpace: "nowrap", border: 0 };

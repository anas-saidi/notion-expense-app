"use client";
import { useLayoutEffect, useRef, type ReactNode } from "react";
import { ArrowUpIcon, XIcon } from "./icons";
import "./prompt-input.css";

/**
 * Prompt input for the app's AI asks, ported from prompt-kit's PromptInput and PromptSuggestion
 * (https://www.prompt-kit.com/docs/prompt-input) into our own CSS: a rounded field that grows with the text
 * (up to `maxHeight`), Enter to send and Shift+Enter for a new line, the send button inside the field
 * (it turns into Stop while loading), and optional suggestion pills above that fill the field.
 */
export function PromptInput({ id, label, value, onValueChange, onSubmit, onStop, loading = false, disabled = false, placeholder, suggestions = [], hint, maxHeight = 240, autoFocus = false }: {
  id: string;
  /** Accessible name; the placeholder shows an example instead of a visible label. */
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  onSubmit: () => void;
  /** Cancels a request in flight; without it, the button just shows progress. */
  onStop?: () => void;
  loading?: boolean;
  disabled?: boolean;
  placeholder?: string;
  /** Example asks that fill the field when tapped (they don't send). */
  suggestions?: string[];
  /** Quiet text at the start of the actions row, e.g. who reads this. */
  hint?: ReactNode;
  maxHeight?: number;
  /** Focus the field on mount, e.g. when it opens on request. */
  autoFocus?: boolean;
}) {
  const field = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const element = field.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, maxHeight)}px`;
  }, [value, maxHeight]);
  const canSend = !!value.trim() && !disabled && !loading;
  return <div className="prompt">
    {suggestions.length > 0 && !value.trim() && !loading && <div className="prompt-suggestions" role="group" aria-label="Suggestions">
      {suggestions.map(suggestion => <button key={suggestion} type="button" className="prompt-suggestion" disabled={disabled} onClick={() => { onValueChange(suggestion); field.current?.focus(); }}>{suggestion}</button>)}
    </div>}
    <div className="prompt-field" data-disabled={disabled || undefined} onClick={() => field.current?.focus()}>
      <textarea id={id} ref={field} autoFocus={autoFocus} aria-label={label} rows={1} value={value} placeholder={placeholder} disabled={disabled || loading} maxLength={2000}
        onChange={event => onValueChange(event.target.value)}
        onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); if (canSend) onSubmit(); } }} />
      <div className="prompt-actions">
        <span className="prompt-hint">{hint}</span>
        {loading && onStop
          ? <button type="button" className="prompt-send" data-stop aria-label="Stop" onClick={event => { event.stopPropagation(); onStop(); }}><XIcon size={16} strokeWidth={2.4} aria-hidden="true" /></button>
          : <button type="button" className="prompt-send" aria-label={loading ? "Sending" : "Send"} aria-busy={loading} disabled={!canSend} onClick={event => { event.stopPropagation(); onSubmit(); }}><ArrowUpIcon size={16} strokeWidth={2.4} aria-hidden="true" /></button>}
      </div>
    </div>
  </div>;
}

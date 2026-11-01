import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";
import { ChevronRightIcon } from "./icons";
import "./card-header.css";

type Props = {
  title: string;
  action?: ReactNode;
  className?: string;
  titleClassName?: string;
  style?: CSSProperties;
  titleStyle?: CSSProperties;
};

export function CardHeader({ title, action, className = "", titleClassName = "", style, titleStyle }: Props) {
  return <div className={`card-header ${className}`} style={style}>
    <h2 className={`card-header-title ${titleClassName}`} style={{ margin: 0, ...titleStyle }}>{title}</h2>
    {action}
  </div>;
}

export function CardHeaderAction({ children, className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...props} type={props.type ?? "button"} className={`card-header-action ${className}`}>
    <span>{children}</span><ChevronRightIcon size={16} aria-hidden="true" />
  </button>;
}

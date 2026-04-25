import { useLocation } from "wouter";
import { useEffect, useRef } from "react";

interface Props {
  children: React.ReactNode;
  variant?: "fade" | "fade-up";
  className?: string;
}

export function PageTransition({ children, variant = "fade-up", className }: Props) {
  const [location] = useLocation();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const cls = variant === "fade" ? "page-fade" : "page-fade-up";
    node.classList.remove(cls);
    void node.offsetWidth;
    node.classList.add(cls);
  }, [location, variant]);

  return (
    <div
      ref={ref}
      className={`${variant === "fade" ? "page-fade" : "page-fade-up"} ${className ?? ""}`}
    >
      {children}
    </div>
  );
}

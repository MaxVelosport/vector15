import { useEffect } from "react";

const SUFFIX = "Твой Вектор";

export function useDocumentTitle(title?: string | null) {
  useEffect(() => {
    if (!title) return;
    const prev = document.title;
    document.title = `${title} · ${SUFFIX}`;
    return () => {
      document.title = prev;
    };
  }, [title]);
}

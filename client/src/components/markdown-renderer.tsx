import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { cn } from "@/lib/utils";
import { Copy, Check, ExternalLink } from "lucide-react";

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };
  return (
    <button
      onClick={copy}
      className={cn(
        "absolute top-2 right-2 flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium transition-all",
        copied
          ? "bg-emerald-500/20 text-emerald-500"
          : "bg-muted-foreground/10 text-muted-foreground hover:bg-muted-foreground/20 hover:text-foreground"
      )}
      title="Скопировать"
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {copied ? "Скопировано" : "Копировать"}
    </button>
  );
}

export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  return (
    <div className={cn("prose prose-sm dark:prose-invert max-w-none", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
          ul: ({ children }) => <ul className="mb-2 list-disc pl-4 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="mb-2 list-decimal pl-4 space-y-1">{children}</ol>,
          li: ({ children }) => <li className="text-sm">{children}</li>,
          h1: ({ children }) => <h1 className="text-base font-bold mb-2 mt-3">{children}</h1>,
          h2: ({ children }) => <h2 className="text-sm font-bold mb-1.5 mt-2">{children}</h2>,
          h3: ({ children }) => <h3 className="text-sm font-semibold mb-1 mt-2">{children}</h3>,
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors inline-flex items-center gap-0.5"
            >
              {children}
              <ExternalLink className="h-2.5 w-2.5 shrink-0 opacity-60" />
            </a>
          ),
          code: ({ className: codeClass, children, ...props }) => {
            const isInline = !codeClass;
            const raw = String(children).replace(/\n$/, "");
            if (isInline) {
              return (
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono border border-border/40" {...props}>
                  {children}
                </code>
              );
            }
            return (
              <div className="relative group my-2">
                <CopyButton text={raw} />
                <code
                  className={cn(
                    "block rounded-lg bg-muted border border-border/50 p-3 pt-8 text-xs font-mono overflow-x-auto",
                    codeClass
                  )}
                  {...props}
                >
                  {children}
                </code>
              </div>
            );
          },
          pre: ({ children }) => <pre className="my-0 bg-transparent p-0">{children}</pre>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-primary/30 pl-3 my-2 italic text-muted-foreground">
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto my-2 rounded-lg border border-border">
              <table className="w-full border-collapse text-xs">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border-b border-border px-3 py-2 bg-muted font-medium text-left">{children}</th>
          ),
          td: ({ children }) => (
            <td className="border-b border-border/50 px-3 py-1.5 last-row:border-0">{children}</td>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

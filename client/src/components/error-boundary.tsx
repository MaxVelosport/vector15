import { Component, ErrorInfo } from "react";
import { AlertTriangle, RefreshCw, Home, ChevronDown, ChevronUp, Bug } from "lucide-react";
import { Button } from "@/components/ui/button";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** Use "page" for full-page crashes, "section" for inline block crashes */
  variant?: "page" | "section";
  /** Label shown in the error UI so the user knows which part crashed */
  label?: string;
  /** Custom fallback override */
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
}

// ─── Full-page fallback ───────────────────────────────────────────────────────

function PageErrorFallback({
  error,
  errorInfo,
  showDetails,
  onToggleDetails,
  onRetry,
}: {
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
  onToggleDetails: () => void;
  onRetry: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-background via-background to-muted/30 p-6">
      <div className="w-full max-w-md space-y-6 text-center">

        {/* Icon */}
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="h-10 w-10 text-destructive" />
        </div>

        {/* Heading */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Что-то пошло не так</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Произошла непредвиденная ошибка. Попробуйте перезагрузить страницу.
          </p>
        </div>

        {/* Error message card */}
        {error && (
          <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-left">
            <p className="text-xs font-mono text-destructive/80 break-all">
              {error.message || "Неизвестная ошибка"}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button onClick={onRetry} className="gap-2" data-testid="button-error-retry">
            <RefreshCw className="h-4 w-4" />
            Перезагрузить страницу
          </Button>
          <Button
            variant="outline"
            onClick={() => { window.location.href = "/"; }}
            className="gap-2"
            data-testid="button-error-home"
          >
            <Home className="h-4 w-4" />
            На главную
          </Button>
        </div>

        {/* Details toggle */}
        {(error || errorInfo) && (
          <div className="text-left">
            <button
              onClick={onToggleDetails}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              data-testid="button-error-details"
            >
              <Bug className="h-3.5 w-3.5" />
              Детали ошибки
              {showDetails ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
            {showDetails && (
              <div className="mt-2 max-h-48 overflow-auto rounded-xl border border-border bg-muted/50 p-3">
                <pre className="whitespace-pre-wrap break-all text-xs text-muted-foreground leading-relaxed">
                  {error?.stack || "Нет стека вызовов"}
                  {errorInfo?.componentStack ? `\n\nКомпонент:\n${errorInfo.componentStack}` : ""}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* Branding */}
        <p className="text-xs text-muted-foreground/60">Твой Вектор</p>
      </div>
    </div>
  );
}

// ─── Section (inline) fallback ────────────────────────────────────────────────

function SectionErrorFallback({
  label,
  error,
  onRetry,
}: {
  label?: string;
  error: Error | null;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-destructive/20 bg-destructive/5 px-6 py-8 text-center" data-testid="section-error-fallback">
      <AlertTriangle className="h-7 w-7 text-destructive/70" />
      <div>
        <p className="text-sm font-medium text-foreground">
          {label ? `Не удалось загрузить: ${label}` : "Ошибка загрузки блока"}
        </p>
        {error?.message && (
          <p className="mt-1 text-xs text-muted-foreground font-mono">{error.message}</p>
        )}
      </div>
      <Button size="sm" variant="outline" onClick={onRetry} className="gap-1.5" data-testid="button-section-retry">
        <RefreshCw className="h-3.5 w-3.5" />
        Попробовать снова
      </Button>
    </div>
  );
}

// ─── ErrorBoundary class ──────────────────────────────────────────────────────

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null, showDetails: false };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    console.error("[ErrorBoundary] Uncaught error:", {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      label: this.props.label,
    });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null, showDetails: false });
    if (this.props.variant !== "section") {
      window.location.reload();
    }
  };

  toggleDetails = () => {
    this.setState((s) => ({ showDetails: !s.showDetails }));
  };

  render() {
    const { hasError, error, errorInfo, showDetails } = this.state;
    const { children, variant = "page", label, fallback } = this.props;

    if (!hasError) return children;

    if (fallback) return fallback;

    if (variant === "section") {
      return (
        <SectionErrorFallback
          label={label}
          error={error}
          onRetry={this.handleRetry}
        />
      );
    }

    return (
      <PageErrorFallback
        error={error}
        errorInfo={errorInfo}
        showDetails={showDetails}
        onToggleDetails={this.toggleDetails}
        onRetry={this.handleRetry}
      />
    );
  }
}

// ─── Convenience wrapper for pages ───────────────────────────────────────────

export function withPageErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  label?: string
) {
  return function WithErrorBoundary(props: P) {
    return (
      <ErrorBoundary variant="page" label={label}>
        <WrappedComponent {...props} />
      </ErrorBoundary>
    );
  };
}

// ─── Convenience wrapper for sections ────────────────────────────────────────

export function SectionErrorBoundary({
  children,
  label,
}: {
  children: React.ReactNode;
  label?: string;
}) {
  return (
    <ErrorBoundary variant="section" label={label}>
      {children}
    </ErrorBoundary>
  );
}

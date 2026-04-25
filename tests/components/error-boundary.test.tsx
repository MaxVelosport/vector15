// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom";

afterEach(() => {
  cleanup();
});

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick, "data-testid": testId, size: _s, variant: _v, className: _c, ...rest }: any) => (
    <button onClick={onClick} data-testid={testId} {...rest}>{children}</button>
  ),
}));

vi.mock("lucide-react", () => ({
  AlertTriangle: () => null,
  RefreshCw: () => null,
  Home: () => null,
  ChevronDown: () => null,
  ChevronUp: () => null,
  Bug: () => null,
}));

import { ErrorBoundary, SectionErrorBoundary } from "../../client/src/components/error-boundary.js";

const originalConsoleError = console.error;
beforeAll(() => {
  console.error = (...args: any[]) => {
    if (
      typeof args[0] === "string" &&
      (args[0].includes("Error:") ||
        args[0].includes("caught an error") ||
        args[0].includes("The above error occurred") ||
        args[0].includes("[ErrorBoundary]"))
    ) {
      return;
    }
    originalConsoleError(...args);
  };
});

function ThrowError({ message = "Test error" }: { message?: string }) {
  throw new Error(message);
}

function SafeComponent({ text = "All good" }: { text?: string }) {
  return <div>{text}</div>;
}

describe("ErrorBoundary (page variant)", () => {
  it("renders children when no error", () => {
    render(
      <ErrorBoundary variant="page">
        <SafeComponent text="Hello world" />
      </ErrorBoundary>
    );
    expect(screen.getByText("Hello world")).toBeInTheDocument();
  });

  it("renders error fallback UI when a child crashes", () => {
    render(
      <ErrorBoundary variant="page">
        <ThrowError />
      </ErrorBoundary>
    );
    expect(screen.getByText("Что-то пошло не так")).toBeInTheDocument();
  });

  it("shows error message in the fallback UI", () => {
    render(
      <ErrorBoundary variant="page">
        <ThrowError message="Specific crash reason" />
      </ErrorBoundary>
    );
    expect(screen.getByText(/Specific crash reason/)).toBeInTheDocument();
  });

  it("shows 'Перезагрузить страницу' button", () => {
    render(
      <ErrorBoundary variant="page">
        <ThrowError />
      </ErrorBoundary>
    );
    const retryBtn = screen.getByTestId("button-error-retry");
    expect(retryBtn).toBeInTheDocument();
    expect(retryBtn).toHaveTextContent("Перезагрузить страницу");
  });

  it("shows 'На главную' button", () => {
    render(
      <ErrorBoundary variant="page">
        <ThrowError />
      </ErrorBoundary>
    );
    const homeBtn = screen.getByTestId("button-error-home");
    expect(homeBtn).toBeInTheDocument();
    expect(homeBtn).toHaveTextContent("На главную");
  });

  it("shows error details toggle button", () => {
    render(
      <ErrorBoundary variant="page">
        <ThrowError />
      </ErrorBoundary>
    );
    expect(screen.getByTestId("button-error-details")).toBeInTheDocument();
  });

  it("expands error details showing stack trace when toggle clicked", () => {
    render(
      <ErrorBoundary variant="page">
        <ThrowError message="Expandable error" />
      </ErrorBoundary>
    );
    const detailsBtn = screen.getByTestId("button-error-details");
    fireEvent.click(detailsBtn);
    const stackPre = document.querySelector("pre");
    expect(stackPre).not.toBeNull();
    expect(stackPre!.textContent).toContain("Expandable error");
  });

  it("renders custom fallback prop instead of default UI", () => {
    render(
      <ErrorBoundary variant="page" fallback={<div>Custom fallback</div>}>
        <ThrowError />
      </ErrorBoundary>
    );
    expect(screen.getByText("Custom fallback")).toBeInTheDocument();
    expect(screen.queryByText("Что-то пошло не так")).not.toBeInTheDocument();
  });
});

describe("ErrorBoundary (section variant)", () => {
  it("renders children when no error", () => {
    render(
      <ErrorBoundary variant="section" label="My Section">
        <SafeComponent text="Section content" />
      </ErrorBoundary>
    );
    expect(screen.getByText("Section content")).toBeInTheDocument();
  });

  it("shows inline section error instead of full-page error when section crashes", () => {
    render(
      <ErrorBoundary variant="section" label="График занятий">
        <ThrowError />
      </ErrorBoundary>
    );
    expect(screen.getByTestId("section-error-fallback")).toBeInTheDocument();
    expect(screen.queryByText("Что-то пошло не так")).not.toBeInTheDocument();
  });

  it("shows label in section error message", () => {
    render(
      <ErrorBoundary variant="section" label="График занятий">
        <ThrowError />
      </ErrorBoundary>
    );
    expect(screen.getByText(/График занятий/)).toBeInTheDocument();
  });

  it("shows retry button in section error", () => {
    render(
      <ErrorBoundary variant="section">
        <ThrowError />
      </ErrorBoundary>
    );
    const retryBtn = screen.getByTestId("button-section-retry");
    expect(retryBtn).toBeInTheDocument();
    expect(retryBtn).toHaveTextContent("Попробовать снова");
  });
});

describe("SectionErrorBoundary", () => {
  it("renders children normally", () => {
    render(
      <SectionErrorBoundary label="Test">
        <SafeComponent text="Works fine" />
      </SectionErrorBoundary>
    );
    expect(screen.getByText("Works fine")).toBeInTheDocument();
  });

  it("catches crashes and shows section fallback", () => {
    render(
      <SectionErrorBoundary label="Финансовый блок">
        <ThrowError />
      </SectionErrorBoundary>
    );
    expect(screen.getByTestId("section-error-fallback")).toBeInTheDocument();
    expect(screen.getByText(/Финансовый блок/)).toBeInTheDocument();
  });
});

describe("ErrorBoundary isolation", () => {
  it("does not affect sibling components when one child crashes", () => {
    render(
      <div>
        <ErrorBoundary variant="section" label="Crashed">
          <ThrowError />
        </ErrorBoundary>
        <SafeComponent text="I am fine" />
      </div>
    );
    expect(screen.getByText("I am fine")).toBeInTheDocument();
    expect(screen.getByTestId("section-error-fallback")).toBeInTheDocument();
  });
});

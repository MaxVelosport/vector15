import { Link } from "wouter";
import { AlertCircle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full bg-background">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-60" />
      <div className="pointer-events-none absolute inset-0 bg-noise opacity-30" />

      <div className="relative mx-auto flex min-h-screen max-w-3xl items-center justify-center px-6 py-16">
        <Card className="glass w-full">
          <CardContent className="p-8">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm text-muted-foreground" data-testid="text-404-subtitle">
                  Страница не найдена
                </div>
                <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-404-title">
                  404
                </h1>
              </div>
            </div>

            <p className="mt-4 text-sm text-muted-foreground" data-testid="text-404-hint">
              Возможно, вы перешли по старой ссылке. Вернитесь на главную.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/">
                <Button data-testid="button-go-home" className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  На главную
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

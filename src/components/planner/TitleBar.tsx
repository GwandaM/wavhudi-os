import { useState, useEffect } from "react";
import { Minus, Square, X, Copy } from "lucide-react";

export function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false);
  const isElectron = !!window.electronAPI;
  const isMac = window.electronAPI?.platform === "darwin";

  useEffect(() => {
    if (!isElectron) return;

    window.electronAPI!.isMaximized().then(setIsMaximized);
    const cleanup = window.electronAPI!.onMaximizedChange(setIsMaximized);
    return cleanup;
  }, [isElectron]);

  if (!isElectron) return null;

  return (
    <div
      className="title-bar flex items-center h-10 shrink-0 select-none border-b bg-background/80 backdrop-blur-sm"
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
    >
      {/* macOS: spacer for native traffic lights */}
      {isMac && <div className="w-20 shrink-0" />}

      {/* App title — centered */}
      <div className="flex-1 text-center text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Wavhudi OS
      </div>

      {/* Windows / Linux: custom window controls */}
      {!isMac && (
        <div
          className="flex items-center shrink-0"
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
        >
          <button
            onClick={() => window.electronAPI!.minimize()}
            className="inline-flex items-center justify-center h-10 w-12 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => window.electronAPI!.maximize()}
            className="inline-flex items-center justify-center h-10 w-12 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            {isMaximized ? (
              <Copy className="h-3 w-3" />
            ) : (
              <Square className="h-3 w-3" />
            )}
          </button>
          <button
            onClick={() => window.electronAPI!.close()}
            className="inline-flex items-center justify-center h-10 w-12 text-muted-foreground hover:bg-destructive hover:text-destructive-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

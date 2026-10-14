import { CircleAlertIcon, RotateCcwIcon } from "lucide-react";
import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

/**
 * Catches render errors, including a page's code failing to download (offline, or a new
 * build replaced the old files), and offers a reload instead of a blank screen.
 */
export class ErrorBoundary extends Component<
  { children: ReactNode; resetKey?: string },
  { error: Error | null; resetKey?: string }
> {
  state = { error: null as Error | null, resetKey: this.props.resetKey };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  // Navigating to another page clears the error.
  static getDerivedStateFromProps(props: { resetKey?: string }, state: { resetKey?: string }) {
    return props.resetKey !== state.resetKey ? { error: null, resetKey: props.resetKey } : null;
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const chunk = /dynamically imported module|Importing a module script failed|Loading chunk/i.test(error.message);
    return (
      <div role="alert" className="mx-auto flex max-w-md flex-col items-center gap-3 px-4 py-16 text-center">
        <CircleAlertIcon className="size-10 text-destructive" aria-hidden="true" />
        <h1 className="text-xl font-semibold">{chunk ? "This page couldn't load" : "Something went wrong"}</h1>
        <p className="text-sm text-muted-foreground">
          {chunk
            ? "Check your connection, or the app may have just been updated. Reloading usually fixes it."
            : "An unexpected error happened on this page. Reloading usually fixes it."}
        </p>
        <Button onClick={() => window.location.reload()}>
          <RotateCcwIcon />
          Reload
        </Button>
      </div>
    );
  }
}

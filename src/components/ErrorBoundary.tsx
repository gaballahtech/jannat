import { Component } from 'react';
import type { ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { error: Error | null };

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    // Visible in devtools / Vercel logs; no backend reporting yet.
    console.error('[pearlin] UI crash:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="mx-auto flex min-h-[70vh] max-w-[720px] flex-col items-center justify-center px-6 py-24 text-center">
          <p className="text-[11px] tracking-[0.3em] text-black/50">SOMETHING WENT WRONG</p>
          <h1 className="font-display mt-4 text-4xl uppercase sm:text-5xl">Please reload</h1>
          <p className="mt-3 text-[13px] leading-relaxed text-black/55">
            This is on us, not you. Reload the page — your bag and wishlist are saved on this
            device.
          </p>
          <div className="mt-8 flex gap-3">
            <button
              onClick={() => window.location.reload()}
              className="rounded-full bg-black px-8 py-3.5 text-[12px] tracking-[0.2em] text-white transition hover:bg-neutral-800"
            >
              RELOAD
            </button>
            <a
              href="/"
              className="rounded-full border border-black/20 px-8 py-3.5 text-[12px] tracking-[0.2em] transition hover:border-black hover:bg-black hover:text-white"
            >
              HOME
            </a>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

import { Component } from 'react'

// ---------------------------------------------------------------------------
// A safety net around the whole app.
//
// If any screen hits an unexpected problem, React would normally wipe the page
// to blank white. That is the worst possible outcome mid-party, so instead we
// catch it here and show a readable message with a Reload button.
// ---------------------------------------------------------------------------

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, message: '' }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: error && error.message ? error.message : 'Unknown problem' }
  }

  componentDidCatch(error, info) {
    // Leave a trace in the browser console for whoever is helping debug later.
    console.error('The app hit a problem:', error, info)
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-board p-6 text-ivory">
        <div
          className="w-full max-w-md border-[3px] border-line bg-panel p-6 text-center"
          style={{ boxShadow: '9px 9px 0 0 var(--color-ink)' }}
        >
          <svg
            width="34"
            height="34"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="mx-auto mb-3 text-red"
          >
            <path d="M5 4 L19 4 L19 20 L5 20 Z M9 9 L15 15 M15 9 L9 15" />
          </svg>
          <h1 className="mb-2 font-display text-[24px] leading-[1.15] text-ivory">
            The Case Has Gone Cold
          </h1>
          <p className="mb-4 text-[15px] text-ivory">
            The app hit a problem and stopped. Reloading the page usually fixes it, and you will
            keep your place on the case.
          </p>

          <button
            type="button"
            onClick={() => window.location.reload()}
            className="min-h-[54px] w-full border-[3px] border-line bg-red font-body text-sm font-bold tracking-[0.2em] text-panel uppercase"
          >
            Reload the page
          </button>

          <p className="mt-4 text-xs text-dim">
            Technical detail, in case it helps: {this.state.message}
          </p>
        </div>
      </div>
    )
  }
}

import { Component } from 'react';

/** Catches render errors so a broken route never blanks the whole app. */
export class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="crash">
        <h1>Something went wrong</h1>
        <p className="muted">
          The page failed to load. Reloading usually fixes it — your booking data is safe.
        </p>
        <button className="btn btn-primary" type="button" onClick={() => window.location.reload()}>
          Reload TurfChai
        </button>
      </div>
    );
  }
}

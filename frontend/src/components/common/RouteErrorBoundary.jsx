import { Component } from 'react';
import { useLocation } from 'react-router-dom';

/* A stale hashed chunk 404s after a redeploy, so only a reload can recover it. */
const CHUNK_ERROR = /dynamically imported module|module script failed|ChunkLoadError/i;

class Boundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidUpdate(prevProps) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const isStaleChunk = CHUNK_ERROR.test(error.message ?? '');

    return (
      <div className="crash" role="alert">
        <h2>This page didn’t load</h2>
        <p className="muted">
          {isStaleChunk
            ? 'A newer version of TurfChai has been released. Reload to pick it up.'
            : 'Something went wrong while rendering this page. Everything else still works.'}
        </p>
        {isStaleChunk ? (
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => window.location.reload()}
          >
            Reload TurfChai
          </button>
        ) : (
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => this.setState({ error: null })}
          >
            Try again
          </button>
        )}
      </div>
    );
  }
}

/** Contains a page-level crash to the content area so navigation stays usable. */
export function RouteErrorBoundary({ children }) {
  const { pathname } = useLocation();
  return <Boundary resetKey={pathname}>{children}</Boundary>;
}

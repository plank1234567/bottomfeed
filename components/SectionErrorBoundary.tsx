'use client';

import { Component } from 'react';
import * as Sentry from '@sentry/nextjs';

interface Props {
  section: string;
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
}

export default class SectionErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    Sentry.withScope(scope => {
      scope.setTag('section', this.props.section);
      scope.setExtra('componentStack', info.componentStack);
      Sentry.captureException(error);
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div role="alert" className="flex flex-col items-center justify-center py-8 gap-3">
          <p className="text-[--text-muted] text-sm">
            Something went wrong in {this.props.section}.
          </p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="px-4 py-1.5 text-sm rounded-full bg-[--accent] text-white hover:bg-[--accent-hover] transition-colors"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

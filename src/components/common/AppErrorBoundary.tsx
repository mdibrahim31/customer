import React from 'react';

export class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('App Crash Caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 text-slate-900 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-3xl flex items-center justify-center mb-4 border border-rose-200 shadow-sm text-2xl">
            ⚠️
          </div>
          <h2 className="text-xl font-black mb-2 text-slate-900">Interface Recovery</h2>
          <p className="text-xs text-slate-500 max-w-sm mb-4">
            {this.state.error?.message || 'An unexpected rendering error occurred.'}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.hash = '#customer';
                window.location.reload();
              }}
              className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 font-bold rounded-xl text-xs cursor-pointer border border-slate-200 shadow-xs"
            >
              Go to Home
            </button>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-xl text-xs flex items-center space-x-2 cursor-pointer shadow-md"
            >
              <span>Reload App</span>
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

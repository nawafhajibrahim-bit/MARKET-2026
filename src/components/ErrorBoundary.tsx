import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[var(--bg,#f8f9fa)] text-[var(--text,#1a1a2e)] flex items-center justify-center p-6" dir="auto">
          <div className="bg-white dark:bg-[#1f2028] rounded-2xl shadow-2xl border border-black/10 dark:border-white/10 p-8 max-w-md w-full text-center space-y-6">
            {/* Error Icon */}
            <div className="w-20 h-20 mx-auto bg-red-500/10 rounded-full flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-500">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            </div>

            {/* Error Title - Bilingual */}
            <div>
              <h2 className="text-xl font-bold text-red-500 mb-1">حدث خطأ غير متوقع</h2>
              <h3 className="text-lg font-semibold text-gray-500">An unexpected error occurred</h3>
            </div>

            {/* Error Description - Bilingual */}
            <div className="text-sm text-gray-500 space-y-1">
              <p>يرجى إعادة تحميل التطبيق. إذا استمرت المشكلة، يرجى التواصل مع الدعم الفني.</p>
              <p>Please reload the app. If the problem persists, contact support.</p>
            </div>

            {/* Error Details (collapsible) */}
            {this.state.error && (
              <details className="text-left bg-black/5 dark:bg-white/5 rounded-lg p-3 text-xs">
                <summary className="cursor-pointer font-medium text-gray-500 hover:text-gray-700">
                  Error Details / تفاصيل الخطأ
                </summary>
                <pre className="mt-2 whitespace-pre-wrap break-words text-red-600 dark:text-red-400 font-mono">
                  {this.state.error.message}
                </pre>
              </details>
            )}

            {/* Reload Button */}
            <button
              onClick={this.handleReload}
              className="w-full py-3 px-6 bg-[var(--color-primary,#7c3aed)] text-white rounded-xl font-semibold hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-purple-500/20 cursor-pointer"
            >
              إعادة تحميل التطبيق / Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

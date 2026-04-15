
import React, { Component, ErrorInfo, ReactNode } from 'react';
import ErrorState from './ui/ErrorState';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
    /** Called with every caught error — use for Sentry/error reporting */
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
    hasError: boolean;
    error?: Error;
}

/** Check if an error is a chunk/dynamic-import failure (stale deployment) */
function isChunkLoadError(error?: Error): boolean {
    if (!error?.message) return false;
    return (
        error.message.includes('Failed to fetch dynamically imported module') ||
        error.message.includes('Importing a module script failed') ||
        error.message.includes('error loading dynamically imported module') ||
        error.message.includes('Loading chunk') ||
        error.message.includes('Loading CSS chunk')
    );
}

class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
        this.props.onError?.(error, errorInfo);

        // Auto-reload once for chunk load errors (stale deployment)
        if (isChunkLoadError(error)) {
            const RELOAD_KEY = 'chunk_reload_ts';
            const lastReload = sessionStorage.getItem(RELOAD_KEY);
            const now = Date.now();

            if (!lastReload || now - Number(lastReload) > 30_000) {
                sessionStorage.setItem(RELOAD_KEY, String(now));
                window.location.reload();
                return;
            }
        }
    }

    public render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            const chunkError = isChunkLoadError(this.state.error);

            return (
                <div className="p-6">
                    <ErrorState
                        title={chunkError ? "Phiên bản mới" : "Sự cố bất ngờ"}
                        message={
                            chunkError
                                ? "Ứng dụng đã được cập nhật phiên bản mới. Vui lòng tải lại trang."
                                : `Đã xảy ra lỗi trong thành phần này: ${this.state.error?.message}`
                        }
                        onRetry={() => {
                            if (chunkError) {
                                // Force hard reload to get the latest version
                                window.location.reload();
                            } else {
                                this.setState({ hasError: false });
                            }
                        }}
                        retryLabel={chunkError ? "Tải lại trang" : undefined}
                    />
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;

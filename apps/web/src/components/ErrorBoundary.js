import { Component } from "react";
export class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }
    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }
    componentDidCatch(error, errorInfo) {
        console.error("Application error:", error);
        console.error("Component stack:", errorInfo.componentStack);
    }
    handleReload = () => {
        window.location.reload();
    };
    render() {
        if (this.state.hasError) {
            return (<div className="error-boundary">
          <div className="error-boundary-content">
            <h1>Something went wrong</h1>
            <p>The application encountered an unexpected error.</p>
            {this.state.error && (<details>
                <summary>Error details</summary>
                <pre>{this.state.error.message}</pre>
              </details>)}
            <button onClick={this.handleReload} className="error-boundary-button">
              Reload Application
            </button>
          </div>
        </div>);
        }
        return this.props.children;
    }
}

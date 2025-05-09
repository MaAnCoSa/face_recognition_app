// Add TypeScript definitions for global Pyodide
interface Window {
  loadPyodide?: (config: { indexURL: string }) => Promise<any>
}

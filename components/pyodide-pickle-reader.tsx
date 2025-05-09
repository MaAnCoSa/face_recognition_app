"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import Script from "next/script"

interface PyodidePickleReaderProps {
  file: File
  onDataLoaded: (data: any) => void
  onError: (error: string) => void
  onCancel: () => void
}

export default function PyodidePickleReader({ file, onDataLoaded, onError, onCancel }: PyodidePickleReaderProps) {
  const [loadingState, setLoadingState] = useState<string>("initializing")
  const [progress, setProgress] = useState(0)
  const [pyodideLoaded, setPyodideLoaded] = useState(false)

  // Handle Pyodide script loading
  const handlePyodideLoad = () => {
    setPyodideLoaded(true)
  }

  useEffect(() => {
    let isMounted = true

    const processPyodide = async () => {
      if (!pyodideLoaded || !window.loadPyodide) {
        // Wait for Pyodide to load
        setLoadingState("waiting_for_pyodide")
        return
      }

      try {
        if (!isMounted) return

        setLoadingState("loading_pyodide")
        setProgress(10)

        // Load Pyodide using the globally available function
        const pyodide = await window.loadPyodide({
          indexURL: "https://cdn.jsdelivr.net/pyodide/v0.23.4/full/",
        })

        if (!isMounted) return
        setLoadingState("loading_packages")
        setProgress(40)

        // Install required packages
        await pyodide.loadPackagesFromImports("import pickle, json")

        if (!isMounted) return
        setLoadingState("reading_file")
        setProgress(60)

        // Read the file
        const fileContent = await file.arrayBuffer()
        const fileBytes = new Uint8Array(fileContent)

        // Create a Python bytes object
        pyodide.globals.set("pickle_bytes", fileBytes)

        if (!isMounted) return
        setLoadingState("processing")
        setProgress(80)

        // Process the pickle file
        const result = await pyodide.runPythonAsync(`
          import pickle
          import json
          from js import pickle_bytes
          
          try:
              # Convert JS Uint8Array to Python bytes
              python_bytes = bytes(pickle_bytes)
              
              # Load the pickle data
              data = pickle.loads(python_bytes)
              
              # Convert to JSON
              class NumpyEncoder(json.JSONEncoder):
                  def default(self, obj):
                      if hasattr(obj, 'tolist'):
                          return obj.tolist()
                      return json.JSONEncoder.default(self, obj)
              
              json_data = json.dumps(data, cls=NumpyEncoder)
              json_data
          except Exception as e:
              f"ERROR: {str(e)}"
        `)

        if (!isMounted) return

        if (result.startsWith("ERROR:")) {
          throw new Error(result.substring(7))
        }

        // Parse the JSON result
        const parsedData = JSON.parse(result)
        setProgress(100)
        setLoadingState("complete")
        onDataLoaded(parsedData)
      } catch (err) {
        console.error("Error processing pickle file with Pyodide:", err)
        if (isMounted) {
          onError(`Failed to process pickle file: ${err instanceof Error ? err.message : String(err)}`)
        }
      }
    }

    if (pyodideLoaded) {
      processPyodide()
    }

    return () => {
      isMounted = false
    }
  }, [file, onDataLoaded, onError, pyodideLoaded])

  const getStatusMessage = () => {
    switch (loadingState) {
      case "initializing":
        return "Initializing..."
      case "waiting_for_pyodide":
        return "Waiting for Python environment to load..."
      case "loading_pyodide":
        return "Loading Python environment..."
      case "loading_packages":
        return "Loading required packages..."
      case "reading_file":
        return "Reading pickle file..."
      case "processing":
        return "Processing data..."
      case "complete":
        return "Complete!"
      default:
        return "Processing..."
    }
  }

  return (
    <>
      {/* Load Pyodide script */}
      <Script
        src="https://cdn.jsdelivr.net/pyodide/v0.23.4/full/pyodide.js"
        onLoad={handlePyodideLoad}
        strategy="lazyOnload"
      />

      <Card>
        <CardHeader>
          <CardTitle>Processing Pickle File</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertDescription>
              Processing pickle file in browser using Python (WebAssembly). This may take a moment...
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm">{getStatusMessage()}</span>
              <span className="text-sm">{progress}%</span>
            </div>
            <Progress value={progress} className="w-full" />
          </div>

          <Button variant="outline" onClick={onCancel} className="w-full">
            Cancel
          </Button>
        </CardContent>
      </Card>
    </>
  )
}

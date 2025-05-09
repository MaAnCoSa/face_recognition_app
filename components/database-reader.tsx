"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Upload, FileJson, FileX, FileUp } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import PyodidePickleReader from "./pyodide-pickle-reader"

interface DatabaseReaderProps {
  onDatabaseLoaded: (data: Record<string, number[][]>) => void
}

export default function DatabaseReader({ onDatabaseLoaded }: DatabaseReaderProps) {
  const [database, setDatabase] = useState<Record<string, number[][]> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [pickleFile, setPickleFile] = useState<File | null>(null)
  const [useWebAssembly, setUseWebAssembly] = useState(false)

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setFileName(file.name)
    setError(null)
    setIsLoading(true)
    setUploadProgress(0)

    try {
      if (file.name.endsWith(".json")) {
        // Handle JSON files directly in the browser
        const reader = new FileReader()
        reader.onload = (e) => {
          try {
            const content = e.target?.result as string
            const parsedData = JSON.parse(content)

            // Validate the database format
            validateDatabase(parsedData)

            setDatabase(parsedData)
            onDatabaseLoaded(parsedData)
            setIsLoading(false)
            setUploadProgress(100)
          } catch (err) {
            console.error("Error parsing JSON:", err)
            setError(`Invalid database format: ${err instanceof Error ? err.message : String(err)}`)
            setIsLoading(false)
          }
        }
        reader.readAsText(file)
      } else if (file.name.endsWith(".pkl") || file.name.endsWith(".pickle")) {
        // Try API first, fall back to WebAssembly
        try {
          await handlePickleFile(file)
        } catch (err) {
          console.warn("API method failed, falling back to WebAssembly:", err)
          setPickleFile(file)
          setUseWebAssembly(true)
        }
      } else {
        setError("Unsupported file format. Please upload a JSON or pickle file.")
        setIsLoading(false)
      }
    } catch (err) {
      console.error("Error processing file:", err)
      setError("Failed to process file. Please try again.")
      setIsLoading(false)
    }
  }

  // Validate the database format
  const validateDatabase = (data: any) => {
    if (!data || typeof data !== "object") {
      throw new Error("Database must be an object")
    }

    // Check if the database has at least one identity
    if (Object.keys(data).length === 0) {
      throw new Error("Database must contain at least one identity")
    }

    // Check each identity
    for (const [identity, embeddings] of Object.entries(data)) {
      if (!Array.isArray(embeddings)) {
        throw new Error(`Embeddings for identity "${identity}" must be an array`)
      }

      // Check each embedding
      for (const [index, embedding] of embeddings.entries()) {
        if (!Array.isArray(embedding)) {
          throw new Error(`Embedding ${index} for identity "${identity}" must be an array`)
        }

        // Check embedding length
        if (embedding.length !== 128) {
          throw new Error(
            `Embedding ${index} for identity "${identity}" must have 128 dimensions (found ${embedding.length})`,
          )
        }

        // Check that all values are numbers
        for (const value of embedding) {
          if (typeof value !== "number") {
            throw new Error(`Embedding ${index} for identity "${identity}" contains non-numeric values`)
          }
        }
      }
    }
  }

  const handlePickleFile = async (file: File) => {
    try {
      // Create form data
      const formData = new FormData()
      formData.append("file", file)

      // Use fetch with progress tracking
      const xhr = new XMLHttpRequest()
      xhr.open("POST", "/api/read-pickle")

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100)
          setUploadProgress(progress)
        }
      }

      return new Promise<void>((resolve, reject) => {
        xhr.onload = async () => {
          if (xhr.status === 200) {
            const response = JSON.parse(xhr.responseText)

            try {
              // Validate the database format
              validateDatabase(response.data)

              setDatabase(response.data)
              onDatabaseLoaded(response.data)
              setIsLoading(false)
              setUploadProgress(100)
              resolve()
            } catch (err) {
              reject(new Error(`Invalid database format: ${err instanceof Error ? err.message : String(err)}`))
            }
          } else {
            const errorData = JSON.parse(xhr.responseText)
            reject(new Error(errorData.error || "Failed to process pickle file"))
          }
        }

        xhr.onerror = () => {
          reject(new Error("Network error occurred while uploading the file"))
        }

        xhr.send(formData)
      })
    } catch (err) {
      console.error("Error processing pickle file:", err)
      throw err
    }
  }

  const handlePyodideSuccess = (data: any) => {
    try {
      // Validate the database format
      validateDatabase(data)

      setDatabase(data)
      onDatabaseLoaded(data)
      setIsLoading(false)
      setUploadProgress(100)
      setPickleFile(null)
      setUseWebAssembly(false)
    } catch (err) {
      setError(`Invalid database format: ${err instanceof Error ? err.message : String(err)}`)
      setIsLoading(false)
      setPickleFile(null)
      setUseWebAssembly(false)
    }
  }

  const handlePyodideError = (errorMessage: string) => {
    setError(errorMessage)
    setIsLoading(false)
    setPickleFile(null)
    setUseWebAssembly(false)
  }

  const cancelPyodide = () => {
    setPickleFile(null)
    setUseWebAssembly(false)
    setIsLoading(false)
  }

  const clearDatabase = () => {
    setDatabase(null)
    setFileName(null)
    onDatabaseLoaded({} as Record<string, number[][]>)
    setUploadProgress(0)
    setPickleFile(null)
    setUseWebAssembly(false)
  }

  // If we're using WebAssembly to process a pickle file
  if (useWebAssembly && pickleFile) {
    return (
      <PyodidePickleReader
        file={pickleFile}
        onDataLoaded={handlePyodideSuccess}
        onError={handlePyodideError}
        onCancel={cancelPyodide}
      />
    )
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-center p-6 border-2 border-dashed rounded-md">
          <div className="space-y-2 text-center">
            <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
            <div className="text-sm">
              <label htmlFor="file-upload" className="relative cursor-pointer text-primary hover:underline">
                <span>Upload identity database</span>
                <input
                  id="file-upload"
                  name="file-upload"
                  type="file"
                  className="sr-only"
                  accept=".json,.pkl,.pickle"
                  onChange={handleFileUpload}
                  disabled={isLoading}
                />
              </label>
              <p className="text-xs text-muted-foreground">
                Upload a database of face embeddings (JSON or pickle format)
              </p>
            </div>
          </div>
        </div>

        {isLoading && !useWebAssembly && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm">Uploading and processing...</span>
              <span className="text-sm">{uploadProgress}%</span>
            </div>
            <Progress value={uploadProgress} className="w-full" />
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {fileName && (
          <div className="flex items-center justify-between bg-muted p-2 rounded-md">
            <div className="flex items-center">
              {fileName.endsWith(".json") ? <FileJson className="h-5 w-5 mr-2" /> : <FileUp className="h-5 w-5 mr-2" />}
              <span className="text-sm font-medium">{fileName}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={clearDatabase} disabled={isLoading}>
              <FileX className="h-4 w-4" />
            </Button>
          </div>
        )}

        {database && (
          <div>
            <h3 className="text-sm font-medium mb-2">Database Preview:</h3>
            <div className="max-h-[300px] overflow-y-auto text-xs font-mono bg-muted p-2 rounded-md">
              {Object.entries(database).map(([identity, embeddings]) => (
                <div key={identity} className="mb-2">
                  <div className="font-bold">{identity}:</div>
                  <div className="pl-4 text-muted-foreground">
                    {embeddings.length} embeddings, each with {embeddings[0]?.length || 0} dimensions
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

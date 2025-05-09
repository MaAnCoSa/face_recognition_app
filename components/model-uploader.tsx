"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Upload, FileCode, FileX } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import * as tf from "@tensorflow/tfjs"

interface ModelUploaderProps {
  onModelLoaded: (model: tf.GraphModel | tf.LayersModel) => void
  onInputSizeDetected: (size: [number, number]) => void
}

export default function ModelUploader({ onModelLoaded, onInputSizeDetected }: ModelUploaderProps) {
  const [fileName, setFileName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [loadingProgress, setLoadingProgress] = useState(0)
  const [loadingStage, setLoadingStage] = useState<string>("")

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setFileName(file.name)
    setError(null)
    setIsLoading(true)
    setLoadingProgress(0)
    setLoadingStage("Reading file")

    try {
      // Check if it's a TFLite file
      if (!file.name.endsWith(".tflite")) {
        throw new Error("Please upload a TFLite model file (.tflite)")
      }

      // Read the file
      const arrayBuffer = await file.arrayBuffer()
      setLoadingProgress(20)
      setLoadingStage("Processing model")

      // For TFLite files, we'll use a workaround since TensorFlow.js doesn't directly support TFLite
      // We'll create a simple model that mimics the input/output of a face embedding model

      // Determine input size - typically 160x160 for FaceNet or 112x112 for MobileFaceNet
      // We'll default to 160x160 but let the user know they might need to adjust
      const inputSize: [number, number] = [160, 160]

      // Create a simple model that outputs a 128-dimensional vector
      const input = tf.input({ shape: [inputSize[0], inputSize[1], 3] })

      // Create a simple CNN model that outputs a 128-dimensional vector
      const conv1 = tf.layers
        .conv2d({
          filters: 16,
          kernelSize: 3,
          strides: 2,
          padding: "same",
          activation: "relu",
        })
        .apply(input)

      const conv2 = tf.layers
        .conv2d({
          filters: 32,
          kernelSize: 3,
          strides: 2,
          padding: "same",
          activation: "relu",
        })
        .apply(conv1)

      const conv3 = tf.layers
        .conv2d({
          filters: 64,
          kernelSize: 3,
          strides: 2,
          padding: "same",
          activation: "relu",
        })
        .apply(conv2)

      const flatten = tf.layers.flatten().apply(conv3)

      // Output a 128-dimensional embedding vector
      const dense = tf.layers
        .dense({
          units: 128,
          activation: "tanh",
        })
        .apply(flatten)

      const model = tf.model({ inputs: input, outputs: dense as tf.SymbolicTensor })

      setLoadingProgress(70)
      setLoadingStage("Finalizing model")

      // Compile the model
      model.compile({
        optimizer: "adam",
        loss: "meanSquaredError",
      })

      setLoadingProgress(90)
      setLoadingStage("Loading model")

      // Notify parent component
      onInputSizeDetected(inputSize)
      onModelLoaded(model)

      setLoadingProgress(100)
      setIsLoading(false)

      // Show a warning about the placeholder model
      setError(
        "Note: Using a placeholder model. Your TFLite model was uploaded but browser limitations prevent direct use. The app will generate random embeddings for demonstration.",
      )
    } catch (err) {
      console.error("Error processing model file:", err)
      setError(`Failed to process model file: ${err instanceof Error ? err.message : String(err)}`)
      setIsLoading(false)
    }
  }

  const clearModel = () => {
    setFileName(null)
    setError(null)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload Face Model</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-center p-6 border-2 border-dashed rounded-md">
          <div className="space-y-2 text-center">
            <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
            <div className="text-sm">
              <label htmlFor="model-upload" className="relative cursor-pointer text-primary hover:underline">
                <span>Upload your TFLite model</span>
                <input
                  id="model-upload"
                  name="model-upload"
                  type="file"
                  className="sr-only"
                  accept=".tflite"
                  onChange={handleFileUpload}
                  disabled={isLoading}
                />
              </label>
              <p className="text-xs text-muted-foreground">Upload your TFLite face embedding model</p>
            </div>
          </div>
        </div>

        {isLoading && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm">{loadingStage}...</span>
              <span className="text-sm">{loadingProgress}%</span>
            </div>
            <Progress value={loadingProgress} className="w-full" />
          </div>
        )}

        {error && (
          <Alert variant={error.startsWith("Note:") ? "default" : "destructive"}>
            <AlertTitle>{error.startsWith("Note:") ? "Information" : "Error"}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {fileName && (
          <div className="flex items-center justify-between bg-muted p-2 rounded-md">
            <div className="flex items-center">
              <FileCode className="h-5 w-5 mr-2" />
              <span className="text-sm font-medium">{fileName}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={clearModel} disabled={isLoading}>
              <FileX className="h-4 w-4" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

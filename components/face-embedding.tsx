"use client"

import { useEffect, useState } from "react"
import * as tf from "@tensorflow/tfjs"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Loader2, RefreshCw } from "lucide-react"
import { loadFaceNetModel, initializeTensorFlow, getModelInputSize } from "@/lib/model-loader"
import { Button } from "@/components/ui/button"

interface FaceEmbeddingProps {
  imageData: string | null
  onEmbeddingGenerated: (embedding: number[]) => void
  isProcessing: boolean
  customModel?: tf.GraphModel | tf.LayersModel
  customInputSize?: [number, number]
}

export default function FaceEmbedding({
  imageData,
  onEmbeddingGenerated,
  isProcessing,
  customModel,
  customInputSize,
}: FaceEmbeddingProps) {
  const [model, setModel] = useState<tf.GraphModel | tf.LayersModel | null>(null)
  const [modelInputSize, setModelInputSize] = useState<[number, number]>([160, 160])
  const [loading, setLoading] = useState(false)
  const [loadingProgress, setLoadingProgress] = useState(0)
  const [embedding, setEmbedding] = useState<number[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [isUsingCustomModel, setIsUsingCustomModel] = useState(false)

  // Use custom model if provided
  useEffect(() => {
    if (customModel) {
      setModel(customModel)
      setIsUsingCustomModel(true)
      if (customInputSize) {
        setModelInputSize(customInputSize)
      }
      setLoading(false)
      setError(null)
    } else {
      setIsUsingCustomModel(false)
    }
  }, [customModel, customInputSize])

  // Initialize TensorFlow.js and load the model if no custom model
  useEffect(() => {
    let isMounted = true

    async function setupTensorFlowAndModel() {
      // Skip if using custom model
      if (customModel || isUsingCustomModel) return

      try {
        if (!isMounted) return
        setLoading(true)
        setError(null)

        // Initialize TensorFlow.js
        await initializeTensorFlow()

        // Load the model
        const loadedModel = await loadFaceNetModel((progress) => {
          if (isMounted) setLoadingProgress(progress)
        })

        if (!isMounted) return

        // Determine input size for the model
        const inputSize = getModelInputSize(loadedModel)

        setModel(loadedModel)
        setModelInputSize(inputSize)
        setLoading(false)
        console.log(`Face model loaded successfully with input size: ${inputSize[0]}x${inputSize[1]}`)
      } catch (err) {
        console.error("Error loading face model:", err)
        if (isMounted) {
          setError(
            `Failed to load face model. ${err instanceof Error ? err.message : "Please check your internet connection."}`,
          )
          setLoading(false)
        }
      }
    }

    if (!customModel && !isUsingCustomModel) {
      setupTensorFlowAndModel()
    }

    return () => {
      isMounted = false
    }
  }, [retryCount, customModel, isUsingCustomModel])

  // Process the image when isProcessing changes to true
  useEffect(() => {
    if (isProcessing && imageData && model) {
      processImage()
    }
  }, [isProcessing, imageData, model])

  const processImage = async () => {
    if (!imageData || !model) return

    try {
      setError(null)

      // Create an image element from the captured image data
      const img = new Image()
      img.crossOrigin = "anonymous"
      img.src = imageData

      await new Promise((resolve) => {
        img.onload = resolve
      })

      // Preprocess the image for the model
      const tensor = tf.tidy(() => {
        // Convert the image to a tensor
        const imageTensor = tf.browser.fromPixels(img)

        // Resize to expected input size based on the model
        const resized = tf.image.resizeBilinear(imageTensor, modelInputSize)

        // Normalize pixel values to [0, 1]
        const normalized = resized.toFloat().div(tf.scalar(255))

        // Add batch dimension
        return normalized.expandDims(0)
      })

      // Get face embedding
      let result: tf.Tensor

      if (isUsingCustomModel && customModel) {
        // For custom uploaded TFLite models, we're using a placeholder model
        // So we'll generate random embeddings for demonstration
        result = tf.tidy(() => {
          // Generate a random 128-dimensional vector
          const randomEmbedding = tf.randomNormal([1, 128])
          // Normalize it to have unit length (like real face embeddings)
          const norm = tf.norm(randomEmbedding)
          return tf.div(randomEmbedding, norm)
        })
      } else {
        // Use the real model for prediction
        result = model.predict(tensor) as tf.Tensor
      }

      // Convert to array
      const embeddingArray = await result.data()
      const normalizedEmbedding = Array.from(embeddingArray as Float32Array)

      // Cleanup tensors
      tensor.dispose()
      result.dispose()

      setEmbedding(normalizedEmbedding)
      onEmbeddingGenerated(normalizedEmbedding)
    } catch (err) {
      console.error("Error processing image:", err)
      setError(`Failed to process image: ${err instanceof Error ? err.message : "Unknown error"}`)
      onEmbeddingGenerated([])
    }
  }

  const handleRetry = () => {
    setRetryCount((prev) => prev + 1)
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-4 flex flex-col items-center justify-center h-[300px]">
          <div className="text-center space-y-4">
            <h3 className="font-medium">Loading Face Model</h3>
            <Progress value={loadingProgress} className="w-[250px]" />
            <p className="text-sm text-muted-foreground">{loadingProgress}% complete</p>
            <p className="text-xs text-muted-foreground">Using lightweight MobileFaceNet model</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-4 flex flex-col items-center justify-center h-[300px]">
          <div className="text-center text-destructive space-y-4">
            <p>{error}</p>
            <Button onClick={handleRetry} variant="outline" className="mt-4">
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry Loading Model
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (isProcessing) {
    return (
      <Card>
        <CardContent className="p-4 flex items-center justify-center h-[300px]">
          <div className="text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin mx-auto" />
            <p className="text-sm text-muted-foreground">Processing image...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="p-4">
        <h3 className="font-medium mb-2">Face Embedding Vector</h3>
        {isUsingCustomModel && (
          <p className="text-xs text-muted-foreground mb-2">Using your uploaded TFLite model (simulation mode)</p>
        )}

        {imageData && (
          <div className="mb-4">
            <img
              src={imageData || "/placeholder.svg"}
              alt="Captured"
              className="w-full h-auto max-h-[150px] object-contain mx-auto border rounded-md"
            />
          </div>
        )}

        <div className="max-h-[300px] overflow-y-auto text-xs font-mono bg-muted p-2 rounded-md">
          {embedding ? (
            <div className="grid grid-cols-4 gap-1">
              {embedding.map((value, index) => (
                <div key={index} className="flex justify-between">
                  <span className="text-muted-foreground">{index}:</span>
                  <span>{value.toFixed(4)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground p-4">
              Capture an image and click "Process Image" to see the face embedding vector
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

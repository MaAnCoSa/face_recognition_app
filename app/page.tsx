"use client"

import { useState, useEffect } from "react"
import type * as tf from "@tensorflow/tfjs"
import CameraCapture from "@/components/camera-capture"
import FaceEmbedding from "@/components/face-embedding"
import DatabaseReader from "@/components/database-reader"
import ModelUploader from "@/components/model-uploader"
import FaceRecognition from "@/components/face-recognition"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { initializeTensorFlow } from "@/lib/model-loader"
import { Badge } from "@/components/ui/badge"

export default function Home() {
  const [imageData, setImageData] = useState<string | null>(null)
  const [embedding, setEmbedding] = useState<number[] | null>(null)
  const [database, setDatabase] = useState<Record<string, number[][]> | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [modelType, setModelType] = useState<string>("Default")
  const [customModel, setCustomModel] = useState<tf.GraphModel | tf.LayersModel | null>(null)
  const [customInputSize, setCustomInputSize] = useState<[number, number] | null>(null)

  // Initialize TensorFlow.js early
  useEffect(() => {
    initializeTensorFlow()
  }, [])

  const handleModelLoaded = (model: tf.GraphModel | tf.LayersModel) => {
    setCustomModel(model)
    setModelType("Custom TFLite")
  }

  const handleInputSizeDetected = (size: [number, number]) => {
    setCustomInputSize(size)
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-4 md:p-8">
      <Card className="w-full max-w-4xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-center">FaceNet Face Recognition</CardTitle>
            <Badge variant="outline" className="ml-2">
              {modelType}
            </Badge>
          </div>
          <CardDescription className="text-center">Face recognition with custom model support</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="camera" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="camera">Camera & Recognition</TabsTrigger>
              <TabsTrigger value="model">Model</TabsTrigger>
              <TabsTrigger value="database">Database</TabsTrigger>
            </TabsList>
            <TabsContent value="camera" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-4">
                  <CameraCapture onCapture={setImageData} isProcessing={isProcessing} />
                  <div className="flex justify-center">
                    <Button onClick={() => setIsProcessing(true)} disabled={!imageData || isProcessing}>
                      Process Image
                    </Button>
                  </div>
                </div>
                <div className="space-y-4">
                  <FaceEmbedding
                    imageData={imageData}
                    onEmbeddingGenerated={(emb) => {
                      setEmbedding(emb)
                      setIsProcessing(false)
                    }}
                    isProcessing={isProcessing}
                    customModel={customModel || undefined}
                    customInputSize={customInputSize || undefined}
                  />

                  <FaceRecognition embedding={embedding} database={database} />
                </div>
              </div>
            </TabsContent>
            <TabsContent value="model">
              <ModelUploader onModelLoaded={handleModelLoaded} onInputSizeDetected={handleInputSizeDetected} />
            </TabsContent>
            <TabsContent value="database">
              <DatabaseReader onDatabaseLoaded={setDatabase} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </main>
  )
}

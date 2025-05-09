"use client"

import { useRef, useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Camera, RefreshCw } from "lucide-react"

interface CameraCaptureProps {
  onCapture: (imageData: string) => void
  isProcessing: boolean
}

export default function CameraCapture({ onCapture, isProcessing }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [isCameraActive, setIsCameraActive] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
      })

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
        setStream(mediaStream)
        setIsCameraActive(true)
        setError(null)
      }
    } catch (err) {
      console.error("Error accessing camera:", err)
      setError("Could not access camera. Please ensure you've granted camera permissions.")
    }
  }

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop())
      setStream(null)
      setIsCameraActive(false)
      if (videoRef.current) {
        videoRef.current.srcObject = null
      }
    }
  }

  const captureImage = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current
      const canvas = canvasRef.current
      const context = canvas.getContext("2d")

      if (context) {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        context.drawImage(video, 0, 0, canvas.width, canvas.height)

        const imageData = canvas.toDataURL("image/jpeg")
        onCapture(imageData)
      }
    }
  }

  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [])

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="relative bg-black rounded-md overflow-hidden">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-auto"
            style={{ display: isCameraActive ? "block" : "none" }}
          />

          {!isCameraActive && !error && (
            <div className="flex items-center justify-center h-[300px] bg-muted">
              <Button onClick={startCamera} disabled={isProcessing}>
                <Camera className="mr-2 h-4 w-4" />
                Start Camera
              </Button>
            </div>
          )}

          {error && (
            <div className="flex items-center justify-center h-[300px] bg-muted text-destructive p-4 text-center">
              {error}
              <Button variant="outline" onClick={startCamera} className="mt-2">
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry
              </Button>
            </div>
          )}

          <canvas ref={canvasRef} className="hidden" />
        </div>

        {isCameraActive && (
          <div className="flex justify-between">
            <Button onClick={stopCamera} variant="outline" disabled={isProcessing}>
              Stop Camera
            </Button>
            <Button onClick={captureImage} disabled={isProcessing}>
              Capture Image
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

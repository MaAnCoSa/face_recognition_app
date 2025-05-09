"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { findClosestIdentity } from "@/lib/face-recognition"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Badge } from "@/components/ui/badge"
import { User, Users } from "lucide-react"

interface FaceRecognitionProps {
  embedding: number[] | null
  database: Record<string, number[][]> | null
}

export default function FaceRecognition({ embedding, database }: FaceRecognitionProps) {
  const [recognizedIdentity, setRecognizedIdentity] = useState<string>("unknown")
  const [distance, setDistance] = useState<number | null>(null)
  const [threshold, setThreshold] = useState<number>(0.4)
  const [useEuclidean, setUseEuclidean] = useState<boolean>(false)
  const [databaseStats, setDatabaseStats] = useState<{ identities: number; embeddings: number }>({
    identities: 0,
    embeddings: 0,
  })

  // Calculate database statistics
  useEffect(() => {
    if (database) {
      const identities = Object.keys(database).length
      let totalEmbeddings = 0

      for (const embeddings of Object.values(database)) {
        totalEmbeddings += embeddings.length
      }

      setDatabaseStats({ identities, embeddings: totalEmbeddings })
    } else {
      setDatabaseStats({ identities: 0, embeddings: 0 })
    }
  }, [database])

  // Perform face recognition when embedding or database changes
  useEffect(() => {
    if (embedding && database) {
      try {
        const result = findClosestIdentity(embedding, database, threshold, useEuclidean)
        setRecognizedIdentity(result.identity)
        setDistance(result.distance)
      } catch (error) {
        console.error("Error during face recognition:", error)
        setRecognizedIdentity("error")
        setDistance(null)
      }
    } else {
      setRecognizedIdentity("unknown")
      setDistance(null)
    }
  }, [embedding, database, threshold, useEuclidean])

  // Get badge color based on recognition result
  const getBadgeVariant = () => {
    if (recognizedIdentity === "unknown") return "secondary"
    if (recognizedIdentity === "error") return "destructive"
    return "default"
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex justify-between items-center">
          <span>Face Recognition</span>
          {database && (
            <Badge variant="outline" className="ml-2">
              <Users className="h-3 w-3 mr-1" />
              {databaseStats.identities} identities, {databaseStats.embeddings} embeddings
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!database ? (
          <div className="text-center p-4 text-muted-foreground">
            Please upload a database to enable face recognition
          </div>
        ) : !embedding ? (
          <div className="text-center p-4 text-muted-foreground">Process an image to see recognition results</div>
        ) : (
          <>
            <div className="flex flex-col items-center justify-center p-6 bg-muted rounded-lg">
              <User className="h-16 w-16 mb-4 text-primary" />
              <Badge className="text-lg py-1 px-3" variant={getBadgeVariant()}>
                {recognizedIdentity}
              </Badge>
              {distance !== null && (
                <p className="text-sm text-muted-foreground mt-2">Distance: {distance.toFixed(4)}</p>
              )}
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="threshold">Recognition Threshold: {threshold.toFixed(2)}</Label>
                </div>
                <Slider
                  id="threshold"
                  min={0.1}
                  max={1.0}
                  step={0.05}
                  value={[threshold]}
                  onValueChange={(value) => setThreshold(value[0])}
                />
                <p className="text-xs text-muted-foreground">Lower values are more strict (fewer false positives)</p>
              </div>

              <div className="flex items-center space-x-2">
                <Switch id="distance-metric" checked={useEuclidean} onCheckedChange={setUseEuclidean} />
                <Label htmlFor="distance-metric">Use Euclidean Distance (default: Cosine)</Label>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

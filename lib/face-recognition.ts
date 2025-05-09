// Utility functions for face recognition

// Calculate cosine similarity between two vectors
// Returns a value between -1 and 1, where 1 means identical vectors
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error("Vectors must have the same length")
  }

  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }

  normA = Math.sqrt(normA)
  normB = Math.sqrt(normB)

  if (normA === 0 || normB === 0) {
    return 0
  }

  return dotProduct / (normA * normB)
}

// Calculate cosine distance between two vectors
// Returns a value between 0 and 2, where 0 means identical vectors
export function cosineDistance(a: number[], b: number[]): number {
  return 1 - cosineSimilarity(a, b)
}

// Calculate Euclidean distance between two vectors
export function euclideanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error("Vectors must have the same length")
  }

  let sum = 0
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i]
    sum += diff * diff
  }

  return Math.sqrt(sum)
}

// Find the closest identity in the database
export function findClosestIdentity(
  embedding: number[],
  database: Record<string, number[][]>,
  distanceThreshold = 0.4,
  useEuclidean = false,
): { identity: string; distance: number } {
  let closestIdentity = "unknown"
  let minDistance = Number.MAX_VALUE

  // Calculate distance to each identity in the database
  for (const [identity, embeddings] of Object.entries(database)) {
    for (const dbEmbedding of embeddings) {
      // Skip if embedding lengths don't match
      if (dbEmbedding.length !== embedding.length) {
        console.warn(`Embedding length mismatch: ${dbEmbedding.length} vs ${embedding.length}`)
        continue
      }

      // Calculate distance based on selected metric
      const distance = useEuclidean ? euclideanDistance(embedding, dbEmbedding) : cosineDistance(embedding, dbEmbedding)

      // Update closest identity if this distance is smaller
      if (distance < minDistance) {
        minDistance = distance
        closestIdentity = identity
      }
    }
  }

  // Return unknown if the minimum distance is above the threshold
  if (minDistance > distanceThreshold) {
    return { identity: "unknown", distance: minDistance }
  }

  return { identity: closestIdentity, distance: minDistance }
}

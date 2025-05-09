import * as tf from "@tensorflow/tfjs"

// Lightweight model options
const MODEL_URLS = [
  // MobileFaceNet - much smaller than FaceNet (5MB vs 30MB+)
  "https://storage.googleapis.com/tfjs-models/tfjs/mobilefacenet_v1_0.25_224/model.json",
  // Backup URL - BlazeFace (even smaller, but less accurate)
  "https://tfhub.dev/tensorflow/tfjs-model/blazeface/1/default/1",
  // Local fallback (for future use)
  "/models/mobilefacenet/model.json",
]

// Model cache for persistent storage
const MODEL_CACHE_KEY = "facenet-model-cache-v1"

export async function loadFaceNetModel(onProgress: (progress: number) => void): Promise<tf.GraphModel> {
  let lastError = null

  // Check if we have a cached model
  if (typeof indexedDB !== "undefined") {
    try {
      console.log("Trying to load model from IndexedDB cache...")
      onProgress(5)
      const models = await tf.io.listModels()
      const modelInfo = models[MODEL_CACHE_KEY]

      if (modelInfo) {
        onProgress(20)
        console.log("Found cached model, loading...")
        const model = await tf.loadGraphModel(MODEL_CACHE_KEY, {
          onProgress: (fraction) => {
            const adjustedProgress = 20 + Math.round(fraction * 80)
            onProgress(adjustedProgress)
          },
        })

        // Verify model is valid
        const inputTensor = tf.zeros([1, 112, 112, 3]) // MobileFaceNet uses 112x112
        try {
          const result = model.predict(inputTensor) as tf.Tensor
          result.dispose()
          inputTensor.dispose()
          console.log("Successfully loaded model from cache")
          return model
        } catch (predictError) {
          console.warn("Cached model is invalid, will reload from source")
          inputTensor.dispose()
          // Continue to loading from URLs
        }
      }
    } catch (cacheError) {
      console.warn("Error loading from cache:", cacheError)
      // Continue to loading from URLs
    }
  }

  // Try each URL in order until one works
  for (const modelUrl of MODEL_URLS) {
    try {
      console.log(`Attempting to load model from: ${modelUrl}`)
      onProgress(10) // Reset progress for new attempt

      // Load the model with progress tracking
      const model = await tf.loadGraphModel(modelUrl, {
        onProgress: (fraction) => {
          const adjustedProgress = 10 + Math.round(fraction * 90)
          onProgress(adjustedProgress)
        },
      })

      // Test the model to make sure it's valid
      // MobileFaceNet typically uses 112x112 input
      const inputShape = modelUrl.includes("mobilefacenet") ? [1, 112, 112, 3] : [1, 160, 160, 3]
      const inputTensor = tf.zeros(inputShape)

      try {
        const result = model.predict(inputTensor) as tf.Tensor
        result.dispose()
        inputTensor.dispose()
        console.log(`Successfully loaded model from: ${modelUrl}`)

        // Save model to IndexedDB for future use
        if (typeof indexedDB !== "undefined") {
          try {
            await model.save(MODEL_CACHE_KEY)
            console.log("Model saved to IndexedDB cache")
          } catch (saveError) {
            console.warn("Error saving model to cache:", saveError)
          }
        }

        return model
      } catch (predictError) {
        console.error(`Model loaded but prediction failed: ${predictError}`)
        inputTensor.dispose()
        throw predictError
      }
    } catch (error) {
      console.warn(`Failed to load model from ${modelUrl}:`, error)
      lastError = error
      // Continue to the next URL
    }
  }

  // If we get here, all URLs failed
  console.error("All model loading attempts failed")
  throw lastError || new Error("Failed to load face model from all sources")
}

// Helper function to ensure TensorFlow.js is properly initialized
export async function initializeTensorFlow(): Promise<void> {
  try {
    // Make sure TensorFlow.js is ready
    await tf.ready()
    console.log("TensorFlow.js initialized successfully")

    // Set backend to WebGL if available for better performance
    if (tf.getBackend() !== "webgl" && tf.backend().getGPGPUContext) {
      await tf.setBackend("webgl")
      console.log("Using WebGL backend for TensorFlow.js")
    } else {
      console.log(`Current TensorFlow.js backend: ${tf.getBackend()}`)
    }

    // Enable memory management
    if (tf.env().get("WEBGL_DELETE_TEXTURE_THRESHOLD") === -1) {
      // Lower threshold to clean up WebGL textures more aggressively
      tf.env().set("WEBGL_DELETE_TEXTURE_THRESHOLD", 1)
    }
  } catch (error) {
    console.error("Error initializing TensorFlow.js:", error)
  }
}

// Get the input size required by the model
export function getModelInputSize(model: tf.GraphModel): [number, number] {
  // Try to determine from the model's inputs
  try {
    const inputShape = model.inputs[0].shape
    // Shape is typically [batch, height, width, channels]
    if (inputShape && inputShape.length === 4 && inputShape[1] && inputShape[2]) {
      return [inputShape[1], inputShape[2]]
    }
  } catch (e) {
    console.warn("Could not determine input size from model:", e)
  }

  // Default sizes based on model URL or name
  const modelPath = model.modelUrl as string
  if (modelPath && modelPath.includes("mobilefacenet")) {
    return [112, 112] // MobileFaceNet typically uses 112x112
  }

  // Default to FaceNet size
  return [160, 160]
}

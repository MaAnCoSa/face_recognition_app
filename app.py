from flask import Flask, render_template, request, jsonify
import os
import base64
import io
import time
import pickle
import numpy as np
from PIL import Image
import cv2
from threading import Thread, Lock
import logging
from numpy.linalg import norm

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# Thread-safe model cache
model_cache = {
    'embedder': None,
    'detector': None,
    'database': None
}
cache_lock = Lock()
models_loaded = False

def load_models():
    """Background thread function to preload models"""
    global model_cache, models_loaded
    
    try:
        logger.info("⏳ Preloading models in background...")
        
        # Load lightweight detector first
        from mtcnn.mtcnn import MTCNN
        with cache_lock:
            model_cache['detector'] = MTCNN(min_face_size=20, steps_threshold=[0.6, 0.7, 0.7])
        
        # Then load database
        with open("database.pkl", "rb") as f:
            data = pickle.load(f)
            with cache_lock:
                model_cache['database'] = {k: [np.array(e) for e in v] for k, v in data.items()}
        
        # Finally load FaceNet model (weights are now local)
        from keras_facenet import FaceNet
        with cache_lock:
            model_cache['embedder'] = FaceNet()
        
        models_loaded = True
        logger.info("✅ Background model preloading complete")
    
    except Exception as e:
        logger.error(f"❌ Background loading failed: {e}")

# Start background loading
Thread(target=load_models, daemon=True).start()

def get_embedder():
    """Lazy-load FaceNet only when needed"""
    with cache_lock:
        if model_cache['embedder'] is None:
            logger.info("🔄 Lazy-loading FaceNet...")
            from keras_facenet import FaceNet
            model_cache['embedder'] = FaceNet()
        return model_cache['embedder']

def get_detector():
    """Lazy-load MTCNN only when needed"""
    with cache_lock:
        if model_cache['detector'] is None:
            logger.info("🔄 Lazy-loading MTCNN...")
            from mtcnn.mtcnn import MTCNN
            model_cache['detector'] = MTCNN(min_face_size=20)
        return model_cache['detector']

def get_database():
    """Lazy-load database"""
    with cache_lock:
        if model_cache['database'] is None:
            logger.info("🔄 Lazy-loading database...")
            with open("database.pkl", "rb") as f:
                model_cache['database'] = pickle.load(f)
        return model_cache['database']

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/status")
def status():
    """Check model loading status"""
    return jsonify({
        "models_loaded": models_loaded,
        "detector_ready": model_cache['detector'] is not None,
        "embedder_ready": model_cache['embedder'] is not None,
        "database_ready": model_cache['database'] is not None,
        "memory_usage": os.getpid()  # Add actual memory monitoring in production
    })

@app.route("/reconocer", methods=["POST"])
def reconocer():
    try:
        logger.info("🔔 /reconocer endpoint called")
        
        # Get models (will lazy-load if needed)
        detector = get_detector()
        embedder = get_embedder()
        base_datos = get_database()
        
        if None in (detector, embedder, base_datos):
            return jsonify(
                success=False, 
                error="Models not ready yet",
                status={
                    "detector_loaded": detector is not None,
                    "embedder_loaded": embedder is not None,
                    "database_loaded": base_datos is not None
                }
            ), 503
            
        # Get image data
        data = request.get_json(force=True)
        image_data = data.get("image", "")
        if "," in image_data:
            image_data = image_data.split(",", 1)[1]
        img_bytes = base64.b64decode(image_data)

        # Convert to numpy array
        img = Image.open(io.BytesIO(img_bytes))
        arr = np.array(img)
        logger.info(f"🔍 Image received: shape={arr.shape}")

        # Face detection
        detecciones = detector.detect_faces(arr)
        logger.info(f"🔍 Detected {len(detecciones)} faces")

        resultados = []
        for cara in detecciones:
            x, y, w, h = cara["box"]
            x, y = max(0, x), max(0, y)
            x2 = min(arr.shape[1], x + w)
            y2 = min(arr.shape[0], y + h)
            face_img = arr[y:y2, x:x2]
            
            # Process face
            nombre, distancia = reconocer_persona(face_img, embedder, base_datos)
            resultados.append({
                "nombre": nombre,
                "distancia": float(distancia),
                "bbox": [int(x), int(y), int(w), int(h)]
            })

        return jsonify(success=True, resultados=resultados)

    except Exception as e:
        logger.error(f"❌ Recognition error: {str(e)}", exc_info=True)
        return jsonify(success=False, error=str(e)), 500

def reconocer_persona(img_array, embedder, base_datos, umbral=0.8):
    """Recognize a single face"""
    try:
        # Ensure RGB format
        if img_array.ndim == 2:
            img_array = cv2.cvtColor(img_array, cv2.COLOR_GRAY2RGB)
        elif img_array.shape[2] == 4:
            img_array = cv2.cvtColor(img_array, cv2.COLOR_RGBA2RGB)

        # Resize and get embedding
        face_resized = cv2.resize(img_array, (160, 160))
        embedding = embedder.embeddings([face_resized])[0]

        # Find closest match
        nombre_identificado = "Desconocido"
        distancia_minima = float("inf")
        
        for nombre, emb_list in base_datos.items():
            for emb_base in emb_list:
                d = norm(embedding - emb_base)
                if d < distancia_minima and d < umbral:
                    distancia_minima = d
                    nombre_identificado = nombre
                    
        return nombre_identificado, distancia_minima

    except Exception as e:
        logger.error(f"❌ Face processing error: {str(e)}")
        return "Error", float("inf")

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    logger.info(f"Starting server on port {port}")
    app.run(host='0.0.0.0', port=port)
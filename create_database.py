from keras_facenet import FaceNet
import numpy as np
from PIL import Image
import os
import pickle

embedder = FaceNet()

def obtener_embedding(ruta, force_rgb=False):
    # 1) Abrir imagen
    img = Image.open(ruta)
    # 2) Si explicitamente lo pedimos, descartamos canal alfa
    if force_rgb:
        img = img.convert('RGB')
    # 3) Redimensionar y convertir a array
    img = img.resize((160, 160))
    X = np.array(img)
    # 4) Obtener embedding
    embedding = embedder.embeddings([X])
    return embedding[0]

dataset_dir = "data"
embeddings = {}

for persona in os.listdir(dataset_dir):
    persona_dir = os.path.join(dataset_dir, persona)
    if not os.path.isdir(persona_dir):
        continue

    embeddings[persona] = []
    # activamos conversion solo para Edelmira
    need_rgb = (persona.lower() == "ederlmira" or persona == "Edelmira")
    
    for imagen in os.listdir(persona_dir):
        if imagen.startswith('.') or not imagen.lower().endswith(('.jpg', '.jpeg', '.png')):
            continue
        ruta_img = os.path.join(persona_dir, imagen)
        try:
            emb = obtener_embedding(ruta_img, force_rgb=need_rgb)
            embeddings[persona].append(emb)
        except Exception as e:
            print(f"Error en {ruta_img}: {e}")

embeddings_serializables = {
    k: [e.tolist() for e in v] for k, v in embeddings.items()
}

# Guardar con protocolo 4 (compatible con Python 3.8+)
with open("embeddings.pkl", "wb") as f:
    pickle.dump(embeddings_serializables, f, protocol=4)

print("Embeddings generados correctamente.")
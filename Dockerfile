FROM python:3.10-slim

# Install system deps
RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender1 \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Copy pre-downloaded weights
COPY .keras-facenet/ /root/.keras-facenet/

WORKDIR /app
COPY . .
RUN pip install --no-cache-dir -r requirements.txt

CMD ["sh", "-c", "gunicorn --bind 0.0.0.0:${PORT:-8080} --workers 1 --timeout 120 app:app"]
FROM python:3.10-slim

# Install system dependencies required for OpenCASCADE/CadQuery and Trimesh
RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx \
    libegl1-mesa \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY ./app ./app

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

FROM python:3.11-slim

# -------------------------------
# Create non-root user
# -------------------------------
RUN useradd -m -u 10001 executor

# -------------------------------
# Set working directory
# -------------------------------
WORKDIR /app

# -------------------------------
# System optimizations
# -------------------------------
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV PIP_NO_CACHE_DIR=1

# -------------------------------
# Install common execution libs
# -------------------------------
RUN pip install \
    requests \
    aiohttp \
    pydantic \
    numpy \
    pandas

# -------------------------------
# Install runtime server deps
# -------------------------------
COPY requirements.txt .
RUN pip install -r requirements.txt

# -------------------------------
# Copy runtime server
# -------------------------------
COPY . .

# -------------------------------
# Execution workspace
# -------------------------------
RUN mkdir -p /tmp/executions && \
    chown -R executor:executor /tmp/executions && \
    chmod 700 /tmp/executions

# -------------------------------
# Switch to non-root user
# -------------------------------
USER executor

# -------------------------------
# Expose gRPC port
# -------------------------------
EXPOSE 50051

# -------------------------------
# Start runtime server
# -------------------------------
CMD ["python", "-m", "app.server"]
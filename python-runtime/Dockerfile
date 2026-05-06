FROM python:3.11-slim

# -------------------------------
# Create non-root user
# -------------------------------
RUN useradd -m -u 10001 executor

# -------------------------------
# Set working dir
# -------------------------------
WORKDIR /app

# -------------------------------
# Install dependencies
# -------------------------------
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# -------------------------------
# Copy app
# -------------------------------
COPY . .

# -------------------------------
# Create execution directory root
# -------------------------------
RUN mkdir -p /tmp/executions && chown -R executor:executor /tmp/executions

# -------------------------------
# Switch to non-root user
# -------------------------------
USER executor

# -------------------------------
# Python runtime optimizations
# -------------------------------
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

# -------------------------------
# Expose gRPC port
# -------------------------------
EXPOSE 50051

# -------------------------------
# Start server
# -------------------------------
CMD ["python", "-m", "app.server"]
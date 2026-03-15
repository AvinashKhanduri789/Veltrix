package main

import (
	"context"
	"log"
	"os"
	"strconv"
	"veltrix/scheduler_service/internal/app"

	"github.com/joho/godotenv"
)

func main() {
	if err := godotenv.Load(".env"); err != nil {
		log.Printf("no .env loaded, using system environment: %v", err)
	}

	port := 50051
	if rawPort := os.Getenv("SCHEDULER_GRPC_PORT"); rawPort != "" {
		parsed, err := strconv.Atoi(rawPort)
		if err != nil {
			log.Fatalf("invalid SCHEDULER_GRPC_PORT: %v", err)
		}
		port = parsed
	}

	log.Println("Starting Scheduler Service...")
	if err := app.Run(context.Background(), port); err != nil {
		log.Fatalf("failed to start scheduler app: %v", err)
	}
}

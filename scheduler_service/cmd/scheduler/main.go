package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"

	"veltrix/scheduler_service/internal/app"

	"github.com/joho/godotenv"
)

func main() {
	// Load .env only for local dev
	if err := godotenv.Load(".env"); err != nil {
		log.Println("no .env loaded, using system environment")
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	
	go func() {
		sigChan := make(chan os.Signal, 1)
		signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)

		<-sigChan
		log.Println("shutdown signal received")
		cancel()
	}()

	log.Println("Starting Scheduler Service...")

	if err := app.Run(ctx); err != nil {
		log.Fatalf("failed to start scheduler app: %v", err)
	}

	log.Println("Scheduler stopped")
}
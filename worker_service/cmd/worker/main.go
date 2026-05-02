package main

import (
	"log"
	"os"
	"os/signal"
	"syscall"
	"veltrix/worker_service/internal/app"
)

func main() {

	application := app.NewApp()

	go application.Run()

	
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)

	<-sigChan
	log.Println("shutdown signal received")

	application.Stop()
}
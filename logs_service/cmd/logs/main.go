package main

import (
	"log"
	"veltrix/logs_service/internal/transport/grpc"

)

func main(){
	server := grpc.NewGrpcServer(50052)

	log.Println("Starting Logs Service...")

	server.Start()

}
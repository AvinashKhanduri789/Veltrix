package config

import "os"

type Config struct {
	KafkaBrokers string
	LogsTopic    string
	GrpcPort     string
}

func Load() *Config {
	return &Config{
		KafkaBrokers: getEnv("KAFKA_BROKERS", "kafka:9092"),
		LogsTopic:    getEnv("LOGS_TOPIC", "execution-logs-v2"),
		GrpcPort:     getEnv("LOGS_GRPC_PORT", "50053"),
	}
}

func getEnv(key, fallback string) string {
	val := os.Getenv(key)
	if val == "" {
		return fallback
	}
	return val
}
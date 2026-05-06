package config

import "os"

type Config struct {
	KafkaBrokers       string
	RedisAddr          string
	MinioEndpoint      string
	PythonRuntimeAddr  string
	NodeRuntimeAddr	   string
}

func Load() *Config {
	return &Config{
		KafkaBrokers:      getEnv("KAFKA_BROKERS", "localhost:9092"),
		RedisAddr:         getEnv("REDIS_ADDR", "localhost:6379"),
		MinioEndpoint:     getEnv("MINIO_ENDPOINT", "localhost:9000"),
		PythonRuntimeAddr: getEnv("PYTHON_RUNTIME_ADDR", "localhost:50051"),
		NodeRuntimeAddr: getEnv("NODE_RUNTIME_ADDR","localhost:50052"),
	}
}

func getEnv(key, fallback string) string {
	val := os.Getenv(key)
	if val == "" {
		return fallback
	}
	return val
}
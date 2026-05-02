package config

import (
	"os"
	"strconv"
	"strings"
)

type Config struct {
	GRPCPort int

	MongoURI string
	MongoDB  string

	KafkaBrokers []string
	JobTopic     string
	EventTopic   string
	GroupID      string
}

func Load() *Config {
	return &Config{
		GRPCPort: parseInt(getEnv("SCHEDULER_GRPC_PORT", "50051")),

		MongoURI: getEnv("MONGO_URI", "mongodb://localhost:27017"),
		MongoDB:  getEnv("MONGO_DB_NAME", "veltrix"),

		KafkaBrokers: parseBrokers(getEnv("KAFKA_BROKERS", "localhost:9092")),

		JobTopic:   getEnv("KAFKA_JOB_TOPIC", "execution-jobs"),
		EventTopic: getEnv("KAFKA_EVENTS_TOPIC", "execution-events"),
		GroupID:    getEnv("KAFKA_CONSUMER_GROUP", "scheduler-debug"),
	}
}

func getEnv(key, fallback string) string {
	val := os.Getenv(key)
	if val == "" {
		return fallback
	}
	return val
}

func parseInt(val string) int {
	i, _ := strconv.Atoi(val)
	return i
}

func parseBrokers(raw string) []string {
	parts := strings.Split(raw, ",")
	out := make([]string, 0)

	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			out = append(out, p)
		}
	}

	if len(out) == 0 {
		return []string{"localhost:9092"}
	}
	return out
}
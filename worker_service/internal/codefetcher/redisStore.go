package codefetcher

import (
	"context"
	"log"
	"time"
	"github.com/redis/go-redis/v9"
)


type RedisStore  struct{
	client *redis.Client
}



func NewRedisStore (client *redis.Client) *RedisStore {
	return &RedisStore {
		client: client,
	}
}

func (r *RedisStore ) Get(ctx context.Context, codePath string) ([]byte, error){
	code,err:= r.client.Get(ctx,codePath).Bytes()

	if err!=nil{
		log.Printf("code does not found at redis looking in mini io")
		return  nil, err
	}

	return code,nil
}

func (r *RedisStore) Set(parentCtx context.Context, key string, value []byte, ttl time.Duration) error {

	ctx, cancel := context.WithTimeout(parentCtx, 2*time.Second)
	defer cancel()

	err := r.client.Set(ctx, key, value, ttl).Err()
	if err != nil {
		log.Printf("redis SET failed | key=%s err=%v", key, err)
		return err
	}

	return nil
}
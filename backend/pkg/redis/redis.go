package redis

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/carakan/takota/internal/config"
	"github.com/redis/go-redis/v9"
)

var Client *redis.Client
var Enabled bool

func InitRedis(cfg *config.Config) error {
	if !cfg.Redis.Enabled {
		log.Println("⚠ Redis is disabled, using PostgreSQL fallback for auth validation")
		Enabled = false
		return nil
	}

	opt, err := redis.ParseURL(cfg.Redis.URL)
	if err != nil {
		return fmt.Errorf("failed to parse redis URL: %w", err)
	}

	if cfg.Redis.Password != "" {
		opt.Password = cfg.Redis.Password
	}
	opt.DB = cfg.Redis.DB

	Client = redis.NewClient(opt)

	// Test connection
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := Client.Ping(ctx).Err(); err != nil {
		log.Printf("⚠ Redis connection failed: %v, using PostgreSQL fallback", err)
		Enabled = false
		return nil
	}

	Enabled = true
	log.Println("✓ Redis connected successfully")
	return nil
}

func SetAuthID(ctx context.Context, userID string, authID string, expiry time.Duration) error {
	if !Enabled || Client == nil {
		return nil
	}
	key := fmt.Sprintf("auth:%s", userID)
	return Client.Set(ctx, key, authID, expiry).Err()
}

func GetAuthID(ctx context.Context, userID string) (string, error) {
	if !Enabled || Client == nil {
		return "", fmt.Errorf("redis not enabled")
	}
	key := fmt.Sprintf("auth:%s", userID)
	return Client.Get(ctx, key).Result()
}

func DeleteAuthID(ctx context.Context, userID string) error {
	if !Enabled || Client == nil {
		return nil
	}
	key := fmt.Sprintf("auth:%s", userID)
	return Client.Del(ctx, key).Err()
}

func ValidateAuthID(ctx context.Context, userID string, authID string) (bool, error) {
	if !Enabled || Client == nil {
		return false, fmt.Errorf("redis not enabled")
	}

	storedAuthID, err := GetAuthID(ctx, userID)
	if err != nil {
		if err == redis.Nil {
			return false, nil
		}
		return false, err
	}

	return storedAuthID == authID, nil
}

func Close() error {
	if Client != nil {
		return Client.Close()
	}
	return nil
}

// Login attempt tracking
func IncrementLoginAttempts(ctx context.Context, username string) (int, error) {
	if !Enabled || Client == nil {
		return 0, fmt.Errorf("redis not enabled")
	}
	key := fmt.Sprintf("login_attempts:%s", username)
	count, err := Client.Incr(ctx, key).Result()
	if err != nil {
		return 0, err
	}
	// Set expiry on first attempt
	if count == 1 {
		Client.Expire(ctx, key, 5*time.Minute)
	}
	return int(count), nil
}

func GetLoginAttempts(ctx context.Context, username string) (int, error) {
	if !Enabled || Client == nil {
		return 0, nil
	}
	key := fmt.Sprintf("login_attempts:%s", username)
	count, err := Client.Get(ctx, key).Result()
	if err != nil {
		if err == redis.Nil {
			return 0, nil
		}
		return 0, err
	}
	var attempts int
	fmt.Sscanf(count, "%d", &attempts)
	return attempts, nil
}

func ResetLoginAttempts(ctx context.Context, username string) error {
	if !Enabled || Client == nil {
		return nil
	}
	key := fmt.Sprintf("login_attempts:%s", username)
	return Client.Del(ctx, key).Err()
}

func LockAccount(ctx context.Context, username string, duration time.Duration) error {
	if !Enabled || Client == nil {
		return nil
	}
	key := fmt.Sprintf("account_locked:%s", username)
	return Client.Set(ctx, key, "locked", duration).Err()
}

func IsAccountLocked(ctx context.Context, username string) (bool, error) {
	if !Enabled || Client == nil {
		return false, nil
	}
	key := fmt.Sprintf("account_locked:%s", username)
	result, err := Client.Get(ctx, key).Result()
	if err != nil {
		if err == redis.Nil {
			return false, nil
		}
		return false, err
	}
	return result == "locked", nil
}

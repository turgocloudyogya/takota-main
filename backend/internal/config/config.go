package config

import (
	"fmt"
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

type Config struct {
	Server     ServerConfig
	Database   DatabaseConfig
	Redis      RedisConfig
	S3         S3Config
	JWT        JWTConfig
	App        AppConfig
	FileUpload FileUploadConfig
}

type ServerConfig struct {
	Port   string
	AppEnv string
	GinMode string
}

type DatabaseConfig struct {
	Host           string
	Port           string
	User           string
	Password       string
	DBName         string
	SSLMode        string
	SSLEnable      bool
	SSLCA          string
	SSLCert        string
	SSLKey         string
	MaxConnections int
	MaxIdleConns   int
	QueryExecMode  string
}

type RedisConfig struct {
	URL      string
	Password string
	DB       int
	Enabled  bool
}

type S3Config struct {
	Endpoint              string
	AccessKey             string
	SecretKey             string
	BucketName            string
	UseSSL                bool
	UsePathStyleEndpoint  bool
	Region                string
	PublicHost            string
	UseCloudFront         bool
	CloudFrontDomain      string
	CloudFrontPrivateKey  string
	CloudFrontPublicKeyID string
}

type JWTConfig struct {
	Secret       string
	ExpiryHours  int
}

type AppConfig struct {
	MaxLoginAttempts        int
	LoginLockDurationMinutes int
	Timezone                string
}

type FileUploadConfig struct {
	MaxAttendanceFileSizeMB int64
	MaxAbsenceFileSizeMB    int64
}

var GlobalConfig *Config

func LoadConfig() (*Config, error) {
	// Load .env file if exists
	_ = godotenv.Load()

	config := &Config{
		Server: ServerConfig{
			Port:    getEnv("PORT", "8080"),
			AppEnv:  getEnv("APP_ENV", "development"),
			GinMode: getEnv("GIN_MODE", "debug"),
		},
		Database: DatabaseConfig{
			Host:           getEnv("DB_HOST", "localhost"),
			Port:           getEnv("DB_PORT", "5432"),
			User:           getEnv("DB_USER", "takota"),
			Password:       getEnv("DB_PASSWORD", "takota_password"),
			DBName:         getEnv("DB_NAME", "takota_db"),
			SSLMode:        getEnv("DB_SSL_MODE", "disable"),
			SSLEnable:      getEnvAsBool("DB_SSL_ENABLE", false),
			SSLCA:          getEnv("DB_SSL_CA", ""),
			SSLCert:        getEnv("DB_SSL_CERT", ""),
			SSLKey:         getEnv("DB_SSL_KEY", ""),
			MaxConnections: getEnvAsInt("DB_MAX_CONNECTIONS", 25),
			MaxIdleConns:   getEnvAsInt("DB_MAX_IDLE_CONNECTIONS", 10),
			// cache_describe avoids pgx's named server-side prepared statements
			// (stmtcache_*) which can break behind a connection pooler and cause
			// "prepared statement ... already exists (SQLSTATE 42P05)" at startup.
			QueryExecMode: getEnv("DB_QUERY_EXEC_MODE", "cache_describe"),
		},
		Redis: RedisConfig{
			URL:      getEnv("REDIS_URL", ""),
			Password: getEnv("REDIS_PASSWORD", ""),
			DB:       getEnvAsInt("REDIS_DB", 0),
			Enabled:  getEnv("REDIS_URL", "") != "",
		},
		S3: S3Config{
			Endpoint:              getEnv("S3_ENDPOINT", ""),
			AccessKey:             getEnv("S3_ACCESS_KEY", ""),
			SecretKey:             getEnv("S3_SECRET_KEY", ""),
			BucketName:            getEnv("S3_BUCKET_NAME", "takota-bucket"),
			UseSSL:                getEnvAsBool("S3_USE_SSL", true),
			UsePathStyleEndpoint:  getEnvAsBool("S3_USE_PATH_STYLE_ENDPOINT", false),
			Region:                getEnv("S3_REGION", "us-east-1"),
			PublicHost:            getEnv("S3_PUBLIC_HOST", ""),
			UseCloudFront:         getEnvAsBool("S3_USE_CLOUDFRONT", false),
			CloudFrontDomain:      getEnv("CLOUDFRONT_DOMAIN", ""),
			CloudFrontPrivateKey:  getEnv("CLOUDFRONT_PRIVATE_KEY", ""),
			CloudFrontPublicKeyID: getEnv("CLOUDFRONT_PUBLIC_KEY_ID", ""),
		},
		JWT: JWTConfig{
			Secret:      getEnv("JWT_SECRET", "your-secret-key-change-this-in-production"),
			ExpiryHours: getEnvAsInt("JWT_EXPIRY_HOURS", 24),
		},
		App: AppConfig{
			MaxLoginAttempts:         getEnvAsInt("MAX_LOGIN_ATTEMPTS", 5),
			LoginLockDurationMinutes: getEnvAsInt("LOGIN_LOCK_DURATION_MINUTES", 5),
			Timezone:                 getEnv("TIMEZONE_APP", getEnv("TIMEZONE", "UTC")),
		},
		FileUpload: FileUploadConfig{
			MaxAttendanceFileSizeMB: int64(getEnvAsInt("MAX_ATTENDANCE_FILE_SIZE_MB", 10)),
			MaxAbsenceFileSizeMB:    int64(getEnvAsInt("MAX_ABSENCE_FILE_SIZE_MB", 50)),
		},
	}

	GlobalConfig = config
	return config, nil
}

func getEnv(key, defaultValue string) string {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}
	return value
}

func getEnvAsInt(key string, defaultValue int) int {
	valueStr := getEnv(key, "")
	if value, err := strconv.Atoi(valueStr); err == nil {
		return value
	}
	return defaultValue
}

func getEnvAsBool(key string, defaultValue bool) bool {
	valueStr := getEnv(key, "")
	if value, err := strconv.ParseBool(valueStr); err == nil {
		return value
	}
	return defaultValue
}

func getEnvAsFloat(key string, defaultValue float64) float64 {
	valueStr := getEnv(key, "")
	if value, err := strconv.ParseFloat(valueStr, 64); err == nil {
		return value
	}
	return defaultValue
}

func (c *Config) GetDSN() string {
	return fmt.Sprintf(
		"host=%s user=%s password=%s dbname=%s port=%s sslmode=%s TimeZone=%s default_query_exec_mode=%s",
		c.Database.Host,
		c.Database.User,
		c.Database.Password,
		c.Database.DBName,
		c.Database.Port,
		c.Database.SSLMode,
		c.App.Timezone,
		c.Database.QueryExecMode,
	)
}

package s3

import (
	"context"
	"fmt"
	"io"
	"log"
	"mime/multipart"
	"net/url"
	"path/filepath"
	"strings"
	"time"

	"github.com/carakan/takota/internal/config"
	"github.com/google/uuid"
	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
)

var Client *minio.Client
var Config *config.S3Config

func InitS3(cfg *config.Config) error {
	Config = &cfg.S3

	var err error
	Client, err = minio.New(cfg.S3.Endpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(cfg.S3.AccessKey, cfg.S3.SecretKey, ""),
		Secure: cfg.S3.UseSSL,
		Region: cfg.S3.Region,
	})
	if err != nil {
		return fmt.Errorf("failed to create S3 client: %w", err)
	}

	// Create bucket if not exists
	ctx := context.Background()
	exists, err := Client.BucketExists(ctx, cfg.S3.BucketName)
	if err != nil {
		return fmt.Errorf("failed to check bucket existence: %w", err)
	}

	if !exists {
		err = Client.MakeBucket(ctx, cfg.S3.BucketName, minio.MakeBucketOptions{
			Region: cfg.S3.Region,
		})
		if err != nil {
			return fmt.Errorf("failed to create bucket: %w", err)
		}
		log.Printf("✓ Created S3 bucket: %s", cfg.S3.BucketName)
	}

	log.Println("✓ S3 storage initialized successfully")
	return nil
}

// UploadFile uploads a file to S3 and returns the object key
func UploadFile(ctx context.Context, file multipart.File, fileHeader *multipart.FileHeader, folder string) (string, error) {
	// Generate unique filename
	ext := filepath.Ext(fileHeader.Filename)
	filename := fmt.Sprintf("%s%s", uuid.New().String(), ext)
	objectKey := fmt.Sprintf("%s/%s", folder, filename)

	// Get file size
	fileSize := fileHeader.Size

	// Determine content type
	contentType := fileHeader.Header.Get("Content-Type")
	if contentType == "" {
		contentType = "application/octet-stream"
	}

	// Upload to S3
	_, err := Client.PutObject(ctx, Config.BucketName, objectKey, file, fileSize, minio.PutObjectOptions{
		ContentType: contentType,
	})
	if err != nil {
		return "", fmt.Errorf("failed to upload file: %w", err)
	}

	return objectKey, nil
}

// UploadFromReader uploads from an io.Reader
func UploadFromReader(ctx context.Context, reader io.Reader, size int64, objectKey string, contentType string) error {
	_, err := Client.PutObject(ctx, Config.BucketName, objectKey, reader, size, minio.PutObjectOptions{
		ContentType: contentType,
	})
	if err != nil {
		return fmt.Errorf("failed to upload from reader: %w", err)
	}
	return nil
}

// DeleteFile deletes a file from S3
func DeleteFile(ctx context.Context, objectKey string) error {
	if objectKey == "" {
		return nil
	}
	err := Client.RemoveObject(ctx, Config.BucketName, objectKey, minio.RemoveObjectOptions{})
	if err != nil {
		return fmt.Errorf("failed to delete file: %w", err)
	}
	return nil
}

// GetSignedURL generates a signed URL for accessing a file
func GetSignedURL(ctx context.Context, objectKey string, expiry time.Duration) (string, error) {
	if objectKey == "" {
		return "", nil
	}

	// If CloudFront is enabled, use CloudFront signed URL
	if Config.UseCloudFront && Config.CloudFrontDomain != "" {
		return getCloudFrontSignedURL(objectKey, expiry)
	}

	// Otherwise use S3 presigned URL
	reqParams := make(url.Values)
	presignedURL, err := Client.PresignedGetObject(ctx, Config.BucketName, objectKey, expiry, reqParams)
	if err != nil {
		return "", fmt.Errorf("failed to generate signed URL: %w", err)
	}

	return presignedURL.String(), nil
}

// getCloudFrontSignedURL generates CloudFront signed URL
// Note: This is a placeholder. Full implementation requires crypto/rsa for signing
func getCloudFrontSignedURL(objectKey string, expiry time.Duration) (string, error) {
	// Simplified version - in production you'd need to implement proper CloudFront signing
	// with RSA private key
	baseURL := fmt.Sprintf("https://%s/%s", Config.CloudFrontDomain, objectKey)
	
	// For now, return the base URL
	// TODO: Implement proper CloudFront URL signing with RSA
	log.Println("Warning: CloudFront signing not fully implemented, returning base URL")
	return baseURL, nil
}

// ValidateFileType checks if file type is allowed
func ValidateFileType(contentType string, allowedTypes []string) bool {
	for _, allowed := range allowedTypes {
		if strings.HasPrefix(contentType, allowed) {
			return true
		}
	}
	return false
}

// GetAllowedAttendanceTypes returns allowed file types for attendance
func GetAllowedAttendanceTypes() []string {
	return []string{
		"image/jpeg",
		"image/jpg",
		"image/png",
	}
}

// GetAllowedAbsenceTypes returns allowed file types for absence
func GetAllowedAbsenceTypes() []string {
	return []string{
		"application/pdf",
		"application/msword",
		"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
		"image/jpeg",
		"image/jpg",
		"image/png",
	}
}

// ValidateFileSize checks if file size is within limit (size in bytes, limit in MB)
func ValidateFileSize(size int64, limitMB int64) bool {
	limitBytes := limitMB * 1024 * 1024
	return size <= limitBytes
}

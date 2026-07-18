package s3

import (
	"bytes"
	"context"
	"crypto/rsa"
	"fmt"
	"io"
	"log"
	"mime/multipart"
	"path/filepath"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/feature/cloudfront/sign"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"
	cfg "github.com/carakan/takota/internal/config"
	"github.com/google/uuid"
)

var Client *s3.Client
var Config *cfg.S3Config
var readEndpoint string

func InitS3(appConfig *cfg.Config) error {
	Config = &appConfig.S3

	// Validate required credentials
	if Config.AccessKey == "" || Config.SecretKey == "" {
		return fmt.Errorf("S3_ACCESS_KEY and S3_SECRET_KEY are required")
	}
	if Config.BucketName == "" {
		return fmt.Errorf("S3_BUCKET_NAME is required")
	}

	// Parse configuration - exactly matching Node.js logic
	region := Config.Region
	bucket := Config.BucketName
	rawEndpoint := Config.Endpoint
	forcePathStyle := Config.UsePathStyleEndpoint
	publicHost := Config.PublicHost

	// Determine endpoint: if empty, use AWS default
	var endpoint string
	if rawEndpoint == "" {
		endpoint = fmt.Sprintf("https://%s.s3.%s.amazonaws.com", bucket, region)
	} else if strings.HasPrefix(rawEndpoint, "http") {
		endpoint = rawEndpoint
	} else {
		endpoint = "http://" + rawEndpoint
	}

	// Determine if AWS
	isAWS := rawEndpoint == "" || strings.Contains(rawEndpoint, "amazonaws.com")

	// Determine if Cloudflare R2
	isR2 := strings.Contains(rawEndpoint, "r2.cloudflarestorage.com")

	// Build readEndpoint for file preview URLs
	// CRITICAL: Match Node.js logic exactly
	// For non-AWS providers, bucket MUST be in the path when using path-style (Minio)
	// EXCEPTION: R2 public domains (custom domain / *.r2.dev) are bucket-scoped -
	// the bucket must NOT appear in the path, or R2 returns 404.
	if isAWS {
		// AWS S3 uses virtual-hosted style by default
		if publicHost != "" {
			// Custom public host: use as-is (bucket is already in domain)
			readEndpoint = fmt.Sprintf("%s/{{file}}", publicHost)
		} else {
			// Default AWS URL format
			readEndpoint = fmt.Sprintf("https://%s.s3.%s.amazonaws.com/{{file}}", bucket, region)
		}
	} else if isR2 && publicHost != "" {
		// R2 custom domain / *.r2.dev public URL is bound 1:1 to a single bucket -
		// do NOT include the bucket name in the path
		readEndpoint = fmt.Sprintf("%s/{{file}}", publicHost)
	} else {
		// Non-AWS (Minio, etc.) - bucket MUST be in path for path-style endpoints
		if publicHost != "" {
			// Custom public host with bucket in path
			readEndpoint = fmt.Sprintf("%s/%s/{{file}}", publicHost, bucket)
		} else {
			// Default endpoint with bucket in path
			readEndpoint = fmt.Sprintf("%s/%s/{{file}}", endpoint, bucket)
		}
	}

	// Warn if endpoint contains amazonaws.com but forcePathStyle is true
	if strings.Contains(endpoint, "amazonaws.com") && forcePathStyle {
		log.Println("⚠ S3 Endpoint contains 'amazonaws.com' and S3_USE_PATH_STYLE_ENDPOINT=true, this may cause issues")
	}

	// Create AWS config with explicit credentials
	cfg, err := config.LoadDefaultConfig(context.Background(),
		config.WithRegion(region),
		config.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(
			Config.AccessKey,
			Config.SecretKey,
			"",
		)),
	)
	if err != nil {
		return fmt.Errorf("failed to load AWS config: %w", err)
	}

	// Create S3 client with optional custom endpoint
	var clientOptions []func(*s3.Options)

	if !isAWS {
		// For non-AWS providers, set custom endpoint
		clientOptions = append(clientOptions, func(o *s3.Options) {
			o.BaseEndpoint = aws.String(endpoint)
		})
	}

	// Set UsePathStyle for non-AWS or if explicitly set
	clientOptions = append(clientOptions, func(o *s3.Options) {
		o.UsePathStyle = forcePathStyle
	})

	// Disable SSL if needed
	if !Config.UseSSL {
		// For custom endpoints, we need to use HTTP
		if !isAWS {
			clientOptions = append(clientOptions, func(o *s3.Options) {
				// This would require custom transport, but for now we assume HTTPS
				// Users should use proper certificates
			})
		}
	}

	Client = s3.NewFromConfig(cfg, clientOptions...)

	// Check if bucket exists
	ctx := context.Background()
	_, err = Client.HeadBucket(ctx, &s3.HeadBucketInput{
		Bucket: aws.String(bucket),
	})
	if err != nil {
		// Try to create bucket
		var createBucketInput *s3.CreateBucketInput

		if isAWS && region != "us-east-1" {
			// For AWS non-us-east-1, need to specify location constraint
			createBucketInput = &s3.CreateBucketInput{
				Bucket: aws.String(bucket),
				CreateBucketConfiguration: &types.CreateBucketConfiguration{
					LocationConstraint: types.BucketLocationConstraint(region),
				},
			}
		} else {
			createBucketInput = &s3.CreateBucketInput{
				Bucket: aws.String(bucket),
			}
		}

		_, createErr := Client.CreateBucket(ctx, createBucketInput)
		if createErr != nil {
			return fmt.Errorf("failed to check/create bucket: %w", createErr)
		}
		log.Printf("✓ Created S3 bucket: %s", bucket)
	}

	providerName := "S3-compatible"
	if isAWS {
		providerName = "AWS S3"
	} else if strings.Contains(Config.Endpoint, "r2.cloudflarestorage.com") {
		providerName = "Cloudflare R2"
	}

	log.Printf("✓ S3 storage initialized (Provider: %s, Public Host: %s)", providerName, publicHost)
	return nil
}

// BucketOpenURL returns the public URL for accessing a file in bucket
func BucketOpenURL(id string) string {
	if id == "" {
		return ""
	}
	return strings.ReplaceAll(readEndpoint, "{{file}}", id)
}

// BucketOpenURLWithDefault returns URL with default ID fallback
func BucketOpenURLWithDefault(id string, defaultID string) string {
	if id == "" && defaultID != "" {
		return strings.ReplaceAll(readEndpoint, "{{file}}", defaultID)
	}
	if id == "" {
		return ""
	}
	return strings.ReplaceAll(readEndpoint, "{{file}}", id)
}

// UploadFile uploads a file and returns the object key
func UploadFile(ctx context.Context, file multipart.File, fileHeader *multipart.FileHeader, folder string) (string, error) {
	ext := filepath.Ext(fileHeader.Filename)
	filename := fmt.Sprintf("%s%s", uuid.New().String(), ext)
	objectKey := fmt.Sprintf("%s/%s", folder, filename)

	contentType := fileHeader.Header.Get("Content-Type")
	if contentType == "" {
		contentType = "application/octet-stream"
	}

	_, err := Client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(Config.BucketName),
		Key:         aws.String(objectKey),
		Body:        file,
		ContentType: aws.String(contentType),
	})
	if err != nil {
		return "", fmt.Errorf("failed to upload file: %w", err)
	}

	return objectKey, nil
}

// UploadFromBuffer uploads from a byte buffer
func UploadFromBuffer(ctx context.Context, buffer []byte, objectKey string, contentType string) error {
	if contentType == "" {
		contentType = "application/octet-stream"
	}

	reader := bytes.NewReader(buffer)
	_, err := Client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(Config.BucketName),
		Key:         aws.String(objectKey),
		Body:        reader,
		ContentType: aws.String(contentType),
	})
	if err != nil {
		return fmt.Errorf("failed to upload from buffer: %w", err)
	}
	return nil
}

// UploadFromReader uploads from an io.Reader
func UploadFromReader(ctx context.Context, reader io.Reader, size int64, objectKey string, contentType string) error {
	if contentType == "" {
		contentType = "application/octet-stream"
	}

	_, err := Client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(Config.BucketName),
		Key:         aws.String(objectKey),
		Body:        reader,
		ContentType: aws.String(contentType),
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
	_, err := Client.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: aws.String(Config.BucketName),
		Key:    aws.String(objectKey),
	})
	if err != nil {
		return fmt.Errorf("failed to delete file: %w", err)
	}
	return nil
}

// FileExists checks if a file exists in S3
func FileExists(ctx context.Context, objectKey string) (bool, error) {
	_, err := Client.HeadObject(ctx, &s3.HeadObjectInput{
		Bucket: aws.String(Config.BucketName),
		Key:    aws.String(objectKey),
	})
	if err != nil {
		if strings.Contains(err.Error(), "NoSuchKey") || strings.Contains(err.Error(), "NotFound") {
			return false, nil
		}
		return false, fmt.Errorf("failed to check file existence: %w", err)
	}
	return true, nil
}

// ReadFile reads a file from S3 and returns it as byte array
func ReadFile(ctx context.Context, objectKey string) ([]byte, error) {
	result, err := Client.GetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(Config.BucketName),
		Key:    aws.String(objectKey),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to read file: %w", err)
	}
	defer result.Body.Close()

	buf := new(bytes.Buffer)
	_, err = io.Copy(buf, result.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to copy file: %w", err)
	}

	return buf.Bytes(), nil
}

// GetSignedURL generates a presigned URL for accessing a file
// expiry is in time.Duration (e.g., 30*time.Minute for 30 minutes)
func GetSignedURL(ctx context.Context, objectKey string, expiry time.Duration) (string, error) {
	if objectKey == "" {
		return "", nil
	}

	// If CloudFront is enabled, use CloudFront signed URL instead
	if Config.UseCloudFront && Config.CloudFrontDomain != "" {
		return SignedURLAsCloudfront(objectKey, expiry)
	}

	// For non-CloudFront, return the public URL
	// Note: For public buckets, BucketOpenURL is sufficient.
	// For presigned URLs with temporary access, implement using s3.service.PresignClient
	// when needed. For now, this returns the public URL which is acceptable for public buckets.
	return BucketOpenURL(objectKey), nil
}

// SignedURLAsCloudfront generates CloudFront signed URL using AWS SDK library
func SignedURLAsCloudfront(objectKey string, expiry time.Duration) (string, error) {
	if Config.CloudFrontDomain == "" || Config.CloudFrontPrivateKey == "" || Config.CloudFrontPublicKeyID == "" {
		return "", fmt.Errorf("cloudfront configuration is missing")
	}

	domain := Config.CloudFrontDomain
	if !strings.HasPrefix(domain, "http") {
		domain = "https://" + domain
	}

	url := fmt.Sprintf("%s/%s", domain, objectKey)

	// Parse the PEM encoded private key
	// Replace escaped newlines with actual newlines
	privateKeyPEM := strings.ReplaceAll(Config.CloudFrontPrivateKey, "\\n", "\n")
	keyReader := strings.NewReader(privateKeyPEM)

	// Load private key as crypto.Signer
	signer, err := sign.LoadPEMPrivKeyPKCS8AsSigner(keyReader)
	if err != nil {
		// Try loading as regular PEM key (PKCS1 format)
		keyReader = strings.NewReader(privateKeyPEM)
		var privKey *rsa.PrivateKey
		privKey, err = sign.LoadPEMPrivKey(keyReader)
		if err != nil {
			return "", fmt.Errorf("failed to parse CloudFront private key: %w", err)
		}
		signer = privKey
	}

	// Create URLSigner with key pair ID
	urlSigner := sign.NewURLSigner(Config.CloudFrontPublicKeyID, signer)

	// Sign the URL with expiry time
	signedURL, err := urlSigner.Sign(url, time.Now().Add(expiry))
	if err != nil {
		return "", fmt.Errorf("failed to sign URL: %w", err)
	}

	return signedURL, nil
}

// ListFiles lists objects in the bucket with pagination
func ListFiles(ctx context.Context, continuationToken string) (map[string]interface{}, error) {
	input := &s3.ListObjectsV2Input{
		Bucket:  aws.String(Config.BucketName),
		MaxKeys: aws.Int32(20),
	}

	if continuationToken != "" {
		input.ContinuationToken = aws.String(continuationToken)
	}

	result, err := Client.ListObjectsV2(ctx, input)
	if err != nil {
		return nil, fmt.Errorf("failed to list files: %w", err)
	}

	var objects []interface{}
	if result.Contents != nil {
		for _, obj := range result.Contents {
			objects = append(objects, map[string]interface{}{
				"key":            aws.ToString(obj.Key),
				"size":           obj.Size,
				"last_modified":  obj.LastModified,
				"storage_class":  obj.StorageClass,
			})
		}
	}

	nextToken := ""
	if result.NextContinuationToken != nil {
		nextToken = *result.NextContinuationToken
	}

	return map[string]interface{}{
		"list":       objects,
		"next_token": nextToken,
		"is_next":    nextToken != "",
	}, nil
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

// GetAllowedAttendanceTypes returns allowed file types for attendance (photos)
func GetAllowedAttendanceTypes() []string {
	return []string{
		"image/jpeg",
		"image/jpg",
		"image/png",
	}
}

// GetAllowedAbsenceTypes returns allowed file types for absence (documents)
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

// GetFileSize returns the size of a file in S3
func GetFileSize(ctx context.Context, objectKey string) (int64, error) {
	result, err := Client.HeadObject(ctx, &s3.HeadObjectInput{
		Bucket: aws.String(Config.BucketName),
		Key:    aws.String(objectKey),
	})
	if err != nil {
		return 0, fmt.Errorf("failed to get file size: %w", err)
	}
	return *result.ContentLength, nil
}
package main

import (
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/carakan/takota/internal/config"
	"github.com/carakan/takota/internal/controllers"
	"github.com/carakan/takota/internal/middlewares"
	jwtpkg "github.com/carakan/takota/pkg/jwt"
	"github.com/carakan/takota/pkg/database"
	"github.com/carakan/takota/pkg/redis"
	"github.com/carakan/takota/pkg/s3"
	"github.com/gin-gonic/gin"
)

func main() {
	// Load configuration
	cfg, err := config.LoadConfig()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	// Initialize JWT
	jwtpkg.Init(cfg)

	// Initialize Database
	if err := database.InitDB(cfg); err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer database.CloseDB()

	// Initialize Redis
	if err := redis.InitRedis(cfg); err != nil {
		log.Printf("Warning: Redis initialization failed: %v", err)
	}
	defer redis.Close()

	// Initialize S3
	if err := s3.InitS3(cfg); err != nil {
		log.Fatalf("Failed to initialize S3: %v", err)
	}

	// Set Gin mode
	gin.SetMode(cfg.Server.GinMode)

	// Create router
	router := gin.Default()

	// Setup routes
	setupRoutes(router, cfg)

	// Graceful shutdown
	go func() {
		if err := router.Run(":" + cfg.Server.Port); err != nil {
			log.Fatalf("Failed to start server: %v", err)
		}
	}()

	log.Printf("🚀 Server started on port %s", cfg.Server.Port)

	// Wait for interrupt signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down server...")
}

func setupRoutes(router *gin.Engine, cfg *config.Config) {
	db := database.GetDB()

	// Initialize controllers
	authCtrl := &controllers.AuthController{DB: db, Config: cfg}
	userCtrl := &controllers.UserController{DB: db, Config: cfg}
	adminCtrl := &controllers.AdminController{DB: db, Config: cfg}
	allCtrl := &controllers.AllController{DB: db, Config: cfg}

	// Global middleware
	router.Use(middlewares.KeyRequestMiddleware())

	// Health check
	router.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok"})
	})

	// API routes
	api := router.Group("/api")
	{
		// Auth routes (no auth required)
		api.POST("/auth", authCtrl.Login)
		
		// Change password (auth required, no password change validation)
		api.POST("/auth-chpw", middlewares.AuthMiddleware(db), authCtrl.ChangePassword)

		// User routes (auth required + user role + password changed)
		user := api.Group("/user")
		user.Use(middlewares.AuthMiddleware(db))
		user.Use(middlewares.RequireRole("user"))
		user.Use(middlewares.RequirePasswordChanged())
		{
			user.GET("/home", userCtrl.Home)
			user.POST("/attendance", userCtrl.Attendance)
			user.POST("/absence", userCtrl.Absence)
		}

		// Admin routes (auth required + admin role + password changed)
		admin := api.Group("/admin")
		admin.Use(middlewares.AuthMiddleware(db))
		admin.Use(middlewares.RequireRole("admin"))
		admin.Use(middlewares.RequirePasswordChanged())
		{
			// Attendance & Absence management
			admin.GET("/attendances", adminCtrl.ListAttendances)
			admin.GET("/absences", adminCtrl.ListAbsences)
			admin.DELETE("/attendance", adminCtrl.DeleteAttendance)
			admin.PATCH("/absence", adminCtrl.SignatureAbsence)

			// User management
			admin.GET("/users", adminCtrl.ListUsers)
			admin.POST("/user", adminCtrl.CreateUser)
			admin.POST("/user/:user_id", adminCtrl.UpdateUser)
			admin.DELETE("/user/:user_id", adminCtrl.DeleteUser)

			// Export
			admin.GET("/export", adminCtrl.ExportAttendance)
			admin.GET("/export/pdf", adminCtrl.ExportAttendancePDF)
		}

		// All/Global routes (auth required)
		all := api.Group("/all")
		all.Use(middlewares.AuthMiddleware(db))
		{
			all.GET("/info", allCtrl.GetInfo)
			all.GET("/photos", allCtrl.GetPhotos)
		}
	}
}

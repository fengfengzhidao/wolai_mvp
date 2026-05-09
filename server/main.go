package main

import (
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	_ "github.com/go-sql-driver/mysql"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type Config struct {
	Host     string
	Port     string
	User     string
	Password string
	Database string
	AppPort  string
}

type Page struct {
	ID        string  `gorm:"primaryKey;size:64"`
	UserID    string  `gorm:"size:64;not null;index"`
	Title     string  `gorm:"size:255;not null"`
	Content   string  `gorm:"type:longtext;not null"`
	Blocks    string  `gorm:"column:blocks_json;type:longtext;not null"`
	Icon      *string `gorm:"column:icon_json;type:longtext"`
	ParentID  *string `gorm:"size:64;index"`
	Order     int     `gorm:"column:sort_order;not null"`
	CreatedAt int64   `gorm:"column:created_at_millis;not null"`
	UpdatedAt int64   `gorm:"column:updated_at_millis;not null;index"`
}

type User struct {
	ID           string `gorm:"primaryKey;size:64"`
	Username     string `gorm:"size:64;not null;uniqueIndex"`
	PasswordHash string `gorm:"size:255;not null"`
	CreatedAt    int64  `gorm:"column:created_at_millis;not null"`
}

type Session struct {
	ID        string `gorm:"primaryKey;size:64"`
	UserID    string `gorm:"size:64;not null;index"`
	TokenHash string `gorm:"size:64;not null;uniqueIndex"`
	ExpiresAt int64  `gorm:"column:expires_at_millis;not null;index"`
}

type AppState struct {
	Key   string `gorm:"primaryKey;column:state_key;size:128"`
	Value string `gorm:"type:text"`
}

type BlockDTO struct {
	ID       string `json:"id"`
	Type     string `json:"type"`
	Text     string `json:"text"`
	Checked  bool   `json:"checked"`
	Language string `json:"language,omitempty"`
}

type PageIconDTO struct {
	Type  string `json:"type"`
	Date  string `json:"date"`
	Color string `json:"color"`
}

type PageDTO struct {
	ID        string       `json:"id"`
	Title     string       `json:"title"`
	Content   string       `json:"content"`
	Blocks    []BlockDTO   `json:"blocks"`
	Icon      *PageIconDTO `json:"icon"`
	ParentID  *string      `json:"parentId"`
	Order     int          `json:"order"`
	CreatedAt int64        `json:"createdAt"`
	UpdatedAt int64        `json:"updatedAt"`
}

type PagesResponse struct {
	Pages []PageDTO `json:"pages"`
}

type BulkPagesRequest struct {
	Pages []PageDTO `json:"pages"`
}

type ActivePageRequest struct {
	PageID *string `json:"pageId"`
}

type ActivePageResponse struct {
	PageID *string `json:"pageId"`
}

type AuthRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type UserResponse struct {
	ID       string `json:"id"`
	Username string `json:"username"`
}

type AuthResponse struct {
	User UserResponse `json:"user"`
}

const activePageStateKey = "active_page_id"
const sessionCookieName = "wolai_session"
const sessionDuration = 7 * 24 * time.Hour

func main() {
	config := loadConfig()
	db, err := openDatabase(config)
	if err != nil {
		log.Fatalf("connect database: %v", err)
	}

	if err := db.AutoMigrate(&User{}, &Session{}, &Page{}, &AppState{}); err != nil {
		log.Fatalf("migrate database: %v", err)
	}

	router := gin.Default()
	router.Use(corsMiddleware())

	router.GET("/api/health", func(ctx *gin.Context) {
		ctx.JSON(http.StatusOK, gin.H{"status": "ok"})
	})
	router.POST("/api/auth/register", registerUser(db))
	router.POST("/api/auth/login", loginUser(db))
	router.POST("/api/auth/logout", logoutUser(db))

	authenticated := router.Group("/api")
	authenticated.Use(authMiddleware(db))
	authenticated.GET("/auth/me", getCurrentUser())
	authenticated.GET("/pages", listPages(db))
	authenticated.PUT("/pages/bulk", savePages(db))
	authenticated.GET("/active-page", getActivePage(db))
	authenticated.PUT("/active-page", saveActivePage(db))

	addr := ":" + config.AppPort
	log.Printf("wolai backend listening on http://127.0.0.1%s", addr)
	if err := router.Run(addr); err != nil {
		log.Fatalf("run server: %v", err)
	}
}

func loadConfig() Config {
	return Config{
		Host:     envOrDefault("DB_HOST", "127.0.0.1"),
		Port:     envOrDefault("DB_PORT", "3306"),
		User:     envOrDefault("DB_USER", "root"),
		Password: envOrDefault("DB_PASSWORD", "root"),
		Database: envOrDefault("DB_NAME", "wolai_mvp"),
		AppPort:  envOrDefault("PORT", "8080"),
	}
}

func envOrDefault(key string, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}

	return fallback
}

func openDatabase(config Config) (*gorm.DB, error) {
	if err := ensureDatabase(config); err != nil {
		return nil, err
	}

	dsn := fmt.Sprintf(
		"%s:%s@tcp(%s:%s)/%s?charset=utf8mb4&parseTime=True&loc=Local",
		config.User,
		config.Password,
		config.Host,
		config.Port,
		config.Database,
	)

	return gorm.Open(mysql.Open(dsn), &gorm.Config{})
}

func ensureDatabase(config Config) error {
	dsn := fmt.Sprintf(
		"%s:%s@tcp(%s:%s)/?charset=utf8mb4&parseTime=True&loc=Local",
		config.User,
		config.Password,
		config.Host,
		config.Port,
	)
	db, err := sql.Open("mysql", dsn)
	if err != nil {
		return err
	}
	defer db.Close()

	if err := db.Ping(); err != nil {
		return err
	}

	_, err = db.Exec(
		fmt.Sprintf(
			"CREATE DATABASE IF NOT EXISTS `%s` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci",
			config.Database,
		),
	)
	return err
}

func corsMiddleware() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		origin := ctx.GetHeader("Origin")
		if origin != "" {
			ctx.Header("Access-Control-Allow-Origin", origin)
			ctx.Header("Vary", "Origin")
		}
		ctx.Header("Access-Control-Allow-Credentials", "true")
		ctx.Header("Access-Control-Allow-Methods", "GET,PUT,POST,DELETE,OPTIONS")
		ctx.Header("Access-Control-Allow-Headers", "Origin,Content-Type,Accept")

		if ctx.Request.Method == http.MethodOptions {
			ctx.AbortWithStatus(http.StatusNoContent)
			return
		}

		ctx.Next()
	}
}

func registerUser(db *gorm.DB) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		var request AuthRequest
		if err := ctx.ShouldBindJSON(&request); err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "请求格式不正确"})
			return
		}

		username := normalizeUsername(request.Username)
		if username == "" || len(request.Password) < 6 {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "用户名不能为空，密码至少 6 位"})
			return
		}

		passwordHash, err := bcrypt.GenerateFromPassword([]byte(request.Password), bcrypt.DefaultCost)
		if err != nil {
			ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		user := User{
			ID:           randomID(),
			Username:     username,
			PasswordHash: string(passwordHash),
			CreatedAt:    time.Now().UnixMilli(),
		}
		if err := db.Create(&user).Error; err != nil {
			ctx.JSON(http.StatusConflict, gin.H{"error": "用户名已存在"})
			return
		}

		if err := createSession(ctx, db, user.ID); err != nil {
			ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		ctx.JSON(http.StatusCreated, AuthResponse{User: userToResponse(user)})
	}
}

func loginUser(db *gorm.DB) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		var request AuthRequest
		if err := ctx.ShouldBindJSON(&request); err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "请求格式不正确"})
			return
		}

		var user User
		if err := db.First(&user, "username = ?", normalizeUsername(request.Username)).Error; err != nil {
			ctx.JSON(http.StatusUnauthorized, gin.H{"error": "用户名或密码错误"})
			return
		}

		if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(request.Password)); err != nil {
			ctx.JSON(http.StatusUnauthorized, gin.H{"error": "用户名或密码错误"})
			return
		}

		if err := createSession(ctx, db, user.ID); err != nil {
			ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		ctx.JSON(http.StatusOK, AuthResponse{User: userToResponse(user)})
	}
}

func logoutUser(db *gorm.DB) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		if token, err := ctx.Cookie(sessionCookieName); err == nil && token != "" {
			_ = db.Delete(&Session{}, "token_hash = ?", hashToken(token)).Error
		}

		clearSessionCookie(ctx)
		ctx.Status(http.StatusNoContent)
	}
}

func authMiddleware(db *gorm.DB) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		token, err := ctx.Cookie(sessionCookieName)
		if err != nil || token == "" {
			ctx.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "请先登录"})
			return
		}

		var session Session
		now := time.Now().UnixMilli()
		if err := db.First(&session, "token_hash = ? AND expires_at_millis > ?", hashToken(token), now).Error; err != nil {
			clearSessionCookie(ctx)
			ctx.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "登录已过期"})
			return
		}

		var user User
		if err := db.First(&user, "id = ?", session.UserID).Error; err != nil {
			clearSessionCookie(ctx)
			ctx.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "用户不存在"})
			return
		}

		ctx.Set("currentUser", user)
		ctx.Next()
	}
}

func getCurrentUser() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		user, ok := currentUser(ctx)
		if !ok {
			ctx.JSON(http.StatusUnauthorized, gin.H{"error": "请先登录"})
			return
		}

		ctx.JSON(http.StatusOK, AuthResponse{User: userToResponse(user)})
	}
}

func listPages(db *gorm.DB) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		user, ok := currentUser(ctx)
		if !ok {
			ctx.JSON(http.StatusUnauthorized, gin.H{"error": "请先登录"})
			return
		}

		var pages []Page
		if err := db.Where("user_id = ?", user.ID).Order("updated_at_millis DESC").Find(&pages).Error; err != nil {
			ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		pageDTOs := make([]PageDTO, 0, len(pages))
		for _, page := range pages {
			pageDTO, err := pageToDTO(page)
			if err != nil {
				ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			pageDTOs = append(pageDTOs, pageDTO)
		}

		ctx.JSON(http.StatusOK, PagesResponse{Pages: pageDTOs})
	}
}

func savePages(db *gorm.DB) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		user, ok := currentUser(ctx)
		if !ok {
			ctx.JSON(http.StatusUnauthorized, gin.H{"error": "请先登录"})
			return
		}

		var request BulkPagesRequest
		if err := ctx.ShouldBindJSON(&request); err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		models := make([]Page, 0, len(request.Pages))
		for _, pageDTO := range request.Pages {
			page, err := dtoToPage(pageDTO, user.ID)
			if err != nil {
				ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}
			models = append(models, page)
		}

		err := db.Transaction(func(tx *gorm.DB) error {
			incomingIDs := make([]string, 0, len(models))
			for _, page := range models {
				incomingIDs = append(incomingIDs, page.ID)
			}

			if len(incomingIDs) == 0 {
				if err := tx.Where("user_id = ?", user.ID).Delete(&Page{}).Error; err != nil {
					return err
				}
			} else if err := tx.Where("user_id = ? AND id NOT IN ?", user.ID, incomingIDs).Delete(&Page{}).Error; err != nil {
				return err
			}

			if len(models) > 0 {
				return tx.Clauses(clause.OnConflict{
					UpdateAll: true,
				}).Create(&models).Error
			}

			return nil
		})
		if err != nil {
			ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		ctx.Status(http.StatusNoContent)
	}
}

func getActivePage(db *gorm.DB) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		user, ok := currentUser(ctx)
		if !ok {
			ctx.JSON(http.StatusUnauthorized, gin.H{"error": "请先登录"})
			return
		}

		var state AppState
		err := db.First(&state, "state_key = ?", userStateKey(user.ID, activePageStateKey)).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			ctx.JSON(http.StatusOK, ActivePageResponse{PageID: nil})
			return
		}
		if err != nil {
			ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		pageID := state.Value
		ctx.JSON(http.StatusOK, ActivePageResponse{PageID: &pageID})
	}
}

func saveActivePage(db *gorm.DB) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		user, ok := currentUser(ctx)
		if !ok {
			ctx.JSON(http.StatusUnauthorized, gin.H{"error": "请先登录"})
			return
		}

		var request ActivePageRequest
		if err := ctx.ShouldBindJSON(&request); err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		if request.PageID == nil || *request.PageID == "" {
			if err := db.Delete(&AppState{}, "state_key = ?", userStateKey(user.ID, activePageStateKey)).Error; err != nil {
				ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			ctx.Status(http.StatusNoContent)
			return
		}

		state := AppState{
			Key:   userStateKey(user.ID, activePageStateKey),
			Value: *request.PageID,
		}
		if err := db.Clauses(clause.OnConflict{UpdateAll: true}).Create(&state).Error; err != nil {
			ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		ctx.Status(http.StatusNoContent)
	}
}

func dtoToPage(pageDTO PageDTO, userID string) (Page, error) {
	if pageDTO.ID == "" {
		return Page{}, errors.New("page id is required")
	}

	now := time.Now().UnixMilli()
	if pageDTO.CreatedAt == 0 {
		pageDTO.CreatedAt = now
	}
	if pageDTO.UpdatedAt == 0 {
		pageDTO.UpdatedAt = now
	}

	blocksJSON, err := json.Marshal(pageDTO.Blocks)
	if err != nil {
		return Page{}, err
	}

	var iconJSON *string
	if pageDTO.Icon != nil {
		rawIconJSON, err := json.Marshal(pageDTO.Icon)
		if err != nil {
			return Page{}, err
		}
		icon := string(rawIconJSON)
		iconJSON = &icon
	}

	return Page{
		ID:        pageDTO.ID,
		UserID:    userID,
		Title:     pageDTO.Title,
		Content:   pageDTO.Content,
		Blocks:    string(blocksJSON),
		Icon:      iconJSON,
		ParentID:  pageDTO.ParentID,
		Order:     pageDTO.Order,
		CreatedAt: pageDTO.CreatedAt,
		UpdatedAt: pageDTO.UpdatedAt,
	}, nil
}

func pageToDTO(page Page) (PageDTO, error) {
	var blocks []BlockDTO
	if page.Blocks != "" {
		if err := json.Unmarshal([]byte(page.Blocks), &blocks); err != nil {
			return PageDTO{}, err
		}
	}

	var icon *PageIconDTO
	if page.Icon != nil && *page.Icon != "" {
		var parsedIcon PageIconDTO
		if err := json.Unmarshal([]byte(*page.Icon), &parsedIcon); err != nil {
			return PageDTO{}, err
		}
		icon = &parsedIcon
	}

	return PageDTO{
		ID:        page.ID,
		Title:     page.Title,
		Content:   page.Content,
		Blocks:    blocks,
		Icon:      icon,
		ParentID:  page.ParentID,
		Order:     page.Order,
		CreatedAt: page.CreatedAt,
		UpdatedAt: page.UpdatedAt,
	}, nil
}

func createSession(ctx *gin.Context, db *gorm.DB, userID string) error {
	token := randomID() + randomID()
	session := Session{
		ID:        randomID(),
		UserID:    userID,
		TokenHash: hashToken(token),
		ExpiresAt: time.Now().Add(sessionDuration).UnixMilli(),
	}
	if err := db.Create(&session).Error; err != nil {
		return err
	}

	ctx.SetCookie(sessionCookieName, token, int(sessionDuration.Seconds()), "/", "", false, true)
	return nil
}

func clearSessionCookie(ctx *gin.Context) {
	ctx.SetCookie(sessionCookieName, "", -1, "/", "", false, true)
}

func currentUser(ctx *gin.Context) (User, bool) {
	value, exists := ctx.Get("currentUser")
	if !exists {
		return User{}, false
	}

	user, ok := value.(User)
	return user, ok
}

func userToResponse(user User) UserResponse {
	return UserResponse{
		ID:       user.ID,
		Username: user.Username,
	}
}

func userStateKey(userID string, key string) string {
	return userID + ":" + key
}

func normalizeUsername(username string) string {
	return strings.TrimSpace(username)
}

func randomID() string {
	bytes := make([]byte, 16)
	if _, err := rand.Read(bytes); err != nil {
		panic(err)
	}

	return hex.EncodeToString(bytes)
}

func hashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

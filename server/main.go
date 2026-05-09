package main

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	_ "github.com/go-sql-driver/mysql"
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
	Title     string  `gorm:"size:255;not null"`
	Content   string  `gorm:"type:longtext;not null"`
	Blocks    string  `gorm:"column:blocks_json;type:longtext;not null"`
	Icon      *string `gorm:"column:icon_json;type:longtext"`
	ParentID  *string `gorm:"size:64;index"`
	Order     int     `gorm:"column:sort_order;not null"`
	CreatedAt int64   `gorm:"column:created_at_millis;not null"`
	UpdatedAt int64   `gorm:"column:updated_at_millis;not null;index"`
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

const activePageStateKey = "active_page_id"

func main() {
	config := loadConfig()
	db, err := openDatabase(config)
	if err != nil {
		log.Fatalf("connect database: %v", err)
	}

	if err := db.AutoMigrate(&Page{}, &AppState{}); err != nil {
		log.Fatalf("migrate database: %v", err)
	}

	router := gin.Default()
	router.Use(corsMiddleware())

	router.GET("/api/health", func(ctx *gin.Context) {
		ctx.JSON(http.StatusOK, gin.H{"status": "ok"})
	})
	router.GET("/api/pages", listPages(db))
	router.PUT("/api/pages/bulk", savePages(db))
	router.GET("/api/active-page", getActivePage(db))
	router.PUT("/api/active-page", saveActivePage(db))

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
		ctx.Header("Access-Control-Allow-Origin", "*")
		ctx.Header("Access-Control-Allow-Methods", "GET,PUT,POST,DELETE,OPTIONS")
		ctx.Header("Access-Control-Allow-Headers", "Origin,Content-Type,Accept")

		if ctx.Request.Method == http.MethodOptions {
			ctx.AbortWithStatus(http.StatusNoContent)
			return
		}

		ctx.Next()
	}
}

func listPages(db *gorm.DB) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		var pages []Page
		if err := db.Order("updated_at_millis DESC").Find(&pages).Error; err != nil {
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
		var request BulkPagesRequest
		if err := ctx.ShouldBindJSON(&request); err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		models := make([]Page, 0, len(request.Pages))
		for _, pageDTO := range request.Pages {
			page, err := dtoToPage(pageDTO)
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
				if err := tx.Where("1 = 1").Delete(&Page{}).Error; err != nil {
					return err
				}
			} else if err := tx.Where("id NOT IN ?", incomingIDs).Delete(&Page{}).Error; err != nil {
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
		var state AppState
		err := db.First(&state, "state_key = ?", activePageStateKey).Error
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
		var request ActivePageRequest
		if err := ctx.ShouldBindJSON(&request); err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		if request.PageID == nil || *request.PageID == "" {
			if err := db.Delete(&AppState{}, "state_key = ?", activePageStateKey).Error; err != nil {
				ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			ctx.Status(http.StatusNoContent)
			return
		}

		state := AppState{
			Key:   activePageStateKey,
			Value: *request.PageID,
		}
		if err := db.Clauses(clause.OnConflict{UpdateAll: true}).Create(&state).Error; err != nil {
			ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		ctx.Status(http.StatusNoContent)
	}
}

func dtoToPage(pageDTO PageDTO) (Page, error) {
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

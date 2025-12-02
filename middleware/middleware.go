package middleware

import (
	"bytes"
	"context"
	"crypto/subtle"
	"encoding/json"
	"fmt"
	"inventory/logger"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"
)

type responseWriter struct {
	http.ResponseWriter
	statusCode  int
	body        *bytes.Buffer
	wroteHeader bool
}

func (rw *responseWriter) WriteHeader(code int) {
	if rw.wroteHeader {
		return
	}
	rw.statusCode = code
	rw.wroteHeader = true
	rw.ResponseWriter.WriteHeader(code)
}

func (rw *responseWriter) Write(b []byte) (int, error) {
	if !rw.wroteHeader {
		rw.WriteHeader(http.StatusOK)
	}
	if rw.body == nil {
		rw.body = &bytes.Buffer{}
	}
	rw.body.Write(b)
	return rw.ResponseWriter.Write(b)
}

func (rw *responseWriter) StatusCode() int {
	if rw.statusCode == 0 {
		return http.StatusOK
	}
	return rw.statusCode
}

type MiddlewareConfig struct {
	EnableRequestLogging  bool
	EnableResponseLogging bool
	EnableMetrics         bool
	EnableTracing         bool
	MaxRequestSize        int64
	RequestTimeout        time.Duration
	RateLimitPerMinute    int
	EnableCORS            bool
	AllowedOrigins        []string
	EnableCompression     bool
	EnableSecurityHeaders bool
	APIKeyRequired        bool
	APIKey                string
}

var defaultMiddlewareConfig = MiddlewareConfig{
	EnableRequestLogging:  true,
	EnableResponseLogging: false,
	EnableMetrics:         true,
	EnableTracing:         true,
	MaxRequestSize:        10 * 1024 * 1024, // 10MB
	RequestTimeout:        30 * time.Second,
	RateLimitPerMinute:    100,
	EnableCORS:            false,
	AllowedOrigins:        []string{},
	EnableCompression:     true,
	EnableSecurityHeaders: true,
	APIKeyRequired:        false,
	APIKey:                "",
}

func ConfigureMiddleware(config MiddlewareConfig) {
	defaultMiddlewareConfig = config
}

func LoggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rw := &responseWriter{ResponseWriter: w, statusCode: http.StatusOK}

		// Log request
		if defaultMiddlewareConfig.EnableRequestLogging {
			logger.Info("HTTP request started",
				"method", r.Method,
				"path", r.URL.Path,
				"remote_addr", r.RemoteAddr,
				"user_agent", r.UserAgent(),
			)
		}

		next.ServeHTTP(rw, r)

		duration := time.Since(start)
		statusCode := rw.StatusCode()

		// Log response
		if defaultMiddlewareConfig.EnableRequestLogging {
			logger.LogHTTPRequest(r.Method, r.URL.Path, statusCode, duration, "")
		}

		// Log response body if enabled
		if defaultMiddlewareConfig.EnableResponseLogging && rw.body != nil {
			logger.Debug("HTTP response",
				"method", r.Method,
				"path", r.URL.Path,
				"status", statusCode,
				"body_size", rw.body.Len(),
			)
		}
	})
}

func RecoveryMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if err := recover(); err != nil {
				if e, ok := err.(error); ok {
					logger.LogErrorWithStack("Panic recovered", e)
				} else {
					logger.LogErrorWithStack("Panic recovered", fmt.Errorf("%v", err))
				}

				// Send error response
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusInternalServerError)
				json.NewEncoder(w).Encode(map[string]string{
					"error": "Internal server error",
				})
			}
		}()
		next.ServeHTTP(w, r)
	})
}

func AuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !defaultMiddlewareConfig.APIKeyRequired {
			next.ServeHTTP(w, r)
			return
		}

		apiKey := r.Header.Get("X-API-Key")
		if apiKey == "" {
			apiKey = r.URL.Query().Get("api_key")
		}

		expectedKey := defaultMiddlewareConfig.APIKey
		if expectedKey != "" && subtle.ConstantTimeCompare([]byte(apiKey), []byte(expectedKey)) != 1 {
			logger.Warn("Authentication failed",
				"path", r.URL.Path,
				"remote_addr", r.RemoteAddr,
			)
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusUnauthorized)
			json.NewEncoder(w).Encode(map[string]string{
				"error": "Unauthorized",
			})
			return
		}

		if apiKey != "" {
			logger.WithContext("api_key", maskAPIKey(apiKey))
		}
		next.ServeHTTP(w, r)
	})
}

func maskAPIKey(key string) string {
	if len(key) <= 8 {
		return "****"
	}
	return key[:4] + "****" + key[len(key)-4:]
}

type rateLimiter struct {
	visitors map[string]*visitor
	mu       sync.RWMutex
	rate     int
	window   time.Duration
}

type visitor struct {
	lastSeen time.Time
	count    int
}

var globalRateLimiter = &rateLimiter{
	visitors: make(map[string]*visitor),
	rate:     100,
	window:   time.Minute,
}

func RateLimitMiddleware(requestsPerMinute int) func(http.Handler) http.Handler {
	rl := &rateLimiter{
		visitors: make(map[string]*visitor),
		rate:     requestsPerMinute,
		window:   time.Minute,
	}

	go rl.cleanupVisitors()

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ip := getClientIP(r)
			rl.mu.Lock()
			v, exists := rl.visitors[ip]
			if !exists {
				rl.visitors[ip] = &visitor{
					lastSeen: time.Now(),
					count:    1,
				}
				rl.mu.Unlock()
				next.ServeHTTP(w, r)
				return
			}

			if time.Since(v.lastSeen) > rl.window {
				v.count = 1
				v.lastSeen = time.Now()
				rl.mu.Unlock()
				next.ServeHTTP(w, r)
				return
			}

			if v.count >= rl.rate {
				rl.mu.Unlock()
				logger.Warn("Rate limit exceeded",
					"ip", ip,
					"path", r.URL.Path,
				)
				w.Header().Set("Content-Type", "application/json")
				w.Header().Set("X-RateLimit-Limit", fmt.Sprintf("%d", rl.rate))
				w.Header().Set("X-RateLimit-Remaining", "0")
				w.WriteHeader(http.StatusTooManyRequests)
				json.NewEncoder(w).Encode(map[string]string{
					"error": "Rate limit exceeded",
				})
				return
			}

			v.count++
			v.lastSeen = time.Now()
			rl.mu.Unlock()
			w.Header().Set("X-RateLimit-Limit", fmt.Sprintf("%d", rl.rate))
			w.Header().Set("X-RateLimit-Remaining", fmt.Sprintf("%d", rl.rate-v.count))
			next.ServeHTTP(w, r)
		})
	}
}

func (rl *rateLimiter) cleanupVisitors() {
	ticker := time.NewTicker(time.Minute)
	defer ticker.Stop()
	for range ticker.C {
		rl.mu.Lock()
		now := time.Now()
		for ip, v := range rl.visitors {
			if now.Sub(v.lastSeen) > rl.window*2 {
				delete(rl.visitors, ip)
			}
		}
		rl.mu.Unlock()
	}
}

func getClientIP(r *http.Request) string {
	ip := r.Header.Get("X-Forwarded-For")
	if ip != "" {
		parts := strings.Split(ip, ",")
		if len(parts) > 0 {
			return strings.TrimSpace(parts[0])
		}
	}
	ip = r.Header.Get("X-Real-IP")
	if ip != "" {
		return ip
	}
	return strings.Split(r.RemoteAddr, ":")[0]
}

func CORSMiddleware(allowedOrigins []string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			origin := r.Header.Get("Origin")
			allowed := false

			if len(allowedOrigins) == 0 || contains(allowedOrigins, "*") {
				allowed = true
			} else {
				allowed = contains(allowedOrigins, origin)
			}

			if allowed {
				w.Header().Set("Access-Control-Allow-Origin", origin)
				w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH")
				w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-API-Key, X-Request-ID")
				w.Header().Set("Access-Control-Allow-Credentials", "true")
				w.Header().Set("Access-Control-Max-Age", "3600")
			}

			if r.Method == http.MethodOptions {
				w.WriteHeader(http.StatusNoContent)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

func contains(slice []string, item string) bool {
	for _, s := range slice {
		if s == item {
			return true
		}
	}
	return false
}

func RequestSizeLimitMiddleware(maxSize int64) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.ContentLength > maxSize {
				logger.Warn("Request too large",
					"size", r.ContentLength,
					"max", maxSize,
				)
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusRequestEntityTooLarge)
				json.NewEncoder(w).Encode(map[string]string{
					"error": "Request entity too large",
				})
				return
			}
			r.Body = http.MaxBytesReader(w, r.Body, maxSize)
			next.ServeHTTP(w, r)
		})
	}
}

func TimeoutMiddleware(timeout time.Duration) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx := r.Context()
			ctx, cancel := context.WithTimeout(ctx, timeout)
			defer cancel()

			r = r.WithContext(ctx)
			done := make(chan bool, 1)

			go func() {
				next.ServeHTTP(w, r)
				done <- true
			}()

			select {
			case <-done:
				return
			case <-ctx.Done():
				logger.Warn("Request timeout",
					"path", r.URL.Path,
					"timeout", timeout,
				)
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusRequestTimeout)
				json.NewEncoder(w).Encode(map[string]string{
					"error": "Request timeout",
				})
			}
		})
	}
}

func RequestIDMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestID := r.Header.Get("X-Request-ID")
		if requestID == "" {
			requestID = generateRequestID()
		}

		w.Header().Set("X-Request-ID", requestID)
		logger.WithTraceID(requestID)
		r = r.WithContext(context.WithValue(r.Context(), "request_id", requestID))

		next.ServeHTTP(w, r)
	})
}

func generateRequestID() string {
	return fmt.Sprintf("%d-%d", time.Now().UnixNano(), len(fmt.Sprintf("%d", time.Now().UnixNano())))
}

func SecurityHeadersMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("X-XSS-Protection", "1; mode=block")
		w.Header().Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
		w.Header().Set("Content-Security-Policy", "default-src 'self'")
		w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
		w.Header().Set("Permissions-Policy", "geolocation=(), microphone=(), camera=()")

		next.ServeHTTP(w, r)
	})
}

func MetricsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rw := &responseWriter{ResponseWriter: w, statusCode: http.StatusOK}

		next.ServeHTTP(rw, r)

		duration := time.Since(start)
		if defaultMiddlewareConfig.EnableMetrics {
			logger.LogMetrics("http_request_duration_ms", float64(duration.Milliseconds()), map[string]string{
				"method": r.Method,
				"path":   r.URL.Path,
				"status": fmt.Sprintf("%d", rw.StatusCode()),
			})
			if rw.body != nil {
				logger.LogMetrics("http_response_size_bytes", float64(rw.body.Len()), map[string]string{
					"method": r.Method,
					"path":   r.URL.Path,
				})
			}
		}
	})
}

func ChainMiddleware(middlewares ...func(http.Handler) http.Handler) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		for i := len(middlewares) - 1; i >= 0; i-- {
			next = middlewares[i](next)
		}
		return next
	}
}

func TracingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !defaultMiddlewareConfig.EnableTracing {
			next.ServeHTTP(w, r)
			return
		}

		traceID := r.Header.Get("X-Trace-ID")
		if traceID == "" {
			traceID = generateRequestID()
		}

		spanID := generateRequestID()

		logger.WithTraceID(traceID)
		logger.WithSpanID(spanID)

		w.Header().Set("X-Trace-ID", traceID)
		w.Header().Set("X-Span-ID", spanID)

		r = r.WithContext(context.WithValue(r.Context(), "trace_id", traceID))
		r = r.WithContext(context.WithValue(r.Context(), "span_id", spanID))

		next.ServeHTTP(w, r)
	})
}

func AuditMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rw := &responseWriter{ResponseWriter: w, statusCode: http.StatusOK}

		userID := r.Header.Get("X-User-ID")
		if userID == "" {
			userID = "anonymous"
		}

		next.ServeHTTP(rw, r)

		duration := time.Since(start)
		logger.LogAudit(
			r.Method,
			"http_request",
			r.URL.Path,
			userID,
			rw.StatusCode() < 400,
			map[string]interface{}{
				"duration_ms": duration.Milliseconds(),
				"status_code": rw.StatusCode(),
				"remote_addr": r.RemoteAddr,
			},
		)
	})
}

func ValidateContentTypeMiddleware(allowedTypes []string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Method == http.MethodGet || r.Method == http.MethodHead || r.Method == http.MethodOptions {
				next.ServeHTTP(w, r)
				return
			}

			contentType := r.Header.Get("Content-Type")
			allowed := false
			for _, t := range allowedTypes {
				if strings.Contains(contentType, t) {
					allowed = true
					break
				}
			}

			if !allowed {
				logger.Warn("Invalid content type",
					"content_type", contentType,
					"path", r.URL.Path,
				)
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusUnsupportedMediaType)
				json.NewEncoder(w).Encode(map[string]string{
					"error": "Unsupported media type",
				})
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

func HealthCheckMiddleware(healthPath string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.URL.Path == healthPath {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusOK)
				json.NewEncoder(w).Encode(map[string]string{
					"status": "ok",
					"time":   time.Now().Format(time.RFC3339),
				})
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func VersionMiddleware(version string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("X-API-Version", version)
			next.ServeHTTP(w, r)
		})
	}
}

func GzipResponseWriter(w http.ResponseWriter, r *http.Request) http.ResponseWriter {
	if !strings.Contains(r.Header.Get("Accept-Encoding"), "gzip") {
		return w
	}

	gz := &gzipWriter{
		ResponseWriter: w,
		writer:         nil,
	}
	return gz
}

type gzipWriter struct {
	http.ResponseWriter
	writer io.Writer
}

func (gz *gzipWriter) Write(b []byte) (int, error) {
	if gz.writer == nil {
		gz.Header().Set("Content-Encoding", "gzip")
		gz.Header().Set("Vary", "Accept-Encoding")
		gz.writer = io.MultiWriter(gz.ResponseWriter, nil) // Would use gzip.NewWriter in real impl
	}
	return gz.writer.Write(b)
}

func CompressionMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !defaultMiddlewareConfig.EnableCompression {
			next.ServeHTTP(w, r)
			return
		}

		if !strings.Contains(r.Header.Get("Accept-Encoding"), "gzip") {
			next.ServeHTTP(w, r)
			return
		}

		w.Header().Set("Content-Encoding", "gzip")
		w.Header().Set("Vary", "Accept-Encoding")
		next.ServeHTTP(w, r)
	})
}

func MethodNotAllowedMiddleware(allowedMethods []string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			allowed := false
			for _, method := range allowedMethods {
				if r.Method == method {
					allowed = true
					break
				}
			}

			if !allowed {
				w.Header().Set("Allow", strings.Join(allowedMethods, ", "))
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusMethodNotAllowed)
				json.NewEncoder(w).Encode(map[string]string{
					"error": "Method not allowed",
				})
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

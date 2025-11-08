package logger

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"
)

const (
	LevelDebug = "DEBUG"
	LevelInfo  = "INFO"
	LevelWarn  = "WARN"
	LevelError = "ERROR"
	LevelFatal = "FATAL"
)

var (
	logLevel      = LevelInfo
	logFile       *os.File
	logFileWriter io.Writer
	logMutex      sync.Mutex
	contextFields = make(map[string]interface{})
	contextMutex  sync.RWMutex
	enableFileLog = false
	logDir        = "./logs"
	maxFileSize   = int64(10 * 1024 * 1024) // 10MB
	maxBackups    = 5
	outputFormat  = "text" // "text" or "json"
	enableColors  = false
)

type LogEntry struct {
	Timestamp string                 `json:"timestamp"`
	Level     string                 `json:"level"`
	Message   string                 `json:"message"`
	Fields    map[string]interface{} `json:"fields,omitempty"`
	File      string                 `json:"file,omitempty"`
	Line      int                    `json:"line,omitempty"`
	Function  string                 `json:"function,omitempty"`
	TraceID   string                 `json:"traceId,omitempty"`
	SpanID    string                 `json:"spanId,omitempty"`
}

type LoggerConfig struct {
	Level        string
	LogDir       string
	MaxFileSize  int64
	MaxBackups   int
	OutputFormat string
	EnableColors bool
	EnableFileLog bool
}

var defaultConfig = LoggerConfig{
	Level:        LevelInfo,
	LogDir:       "./logs",
	MaxFileSize:  10 * 1024 * 1024,
	MaxBackups:   5,
	OutputFormat: "text",
	EnableColors: false,
	EnableFileLog: false,
}

func init() {
	setupFileLogging()
}

func setupFileLogging() {
	if !defaultConfig.EnableFileLog {
		return
	}
	if err := os.MkdirAll(logDir, 0755); err != nil {
		log.Printf("Failed to create log directory: %v", err)
		return
	}

	logPath := filepath.Join(logDir, fmt.Sprintf("inventory-%s.log", time.Now().Format("2006-01-02")))
	file, err := os.OpenFile(logPath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0666)
	if err != nil {
		log.Printf("Failed to open log file: %v", err)
		return
	}

	logFile = file
	logFileWriter = io.MultiWriter(os.Stdout, file)
	enableFileLog = true
}

func Configure(config LoggerConfig) {
	logMutex.Lock()
	defer logMutex.Unlock()
	
	if config.Level != "" {
		logLevel = strings.ToUpper(config.Level)
		defaultConfig.Level = logLevel
	}
	if config.LogDir != "" {
		logDir = config.LogDir
		defaultConfig.LogDir = config.LogDir
	}
	if config.MaxFileSize > 0 {
		maxFileSize = config.MaxFileSize
		defaultConfig.MaxFileSize = config.MaxFileSize
	}
	if config.MaxBackups > 0 {
		maxBackups = config.MaxBackups
		defaultConfig.MaxBackups = config.MaxBackups
	}
	if config.OutputFormat != "" {
		outputFormat = config.OutputFormat
		defaultConfig.OutputFormat = config.OutputFormat
	}
	enableColors = config.EnableColors
	defaultConfig.EnableColors = config.EnableColors
	enableFileLog = config.EnableFileLog
	defaultConfig.EnableFileLog = config.EnableFileLog
	
	if enableFileLog {
		setupFileLogging()
	}
}

func SetLevel(level string) {
	logMutex.Lock()
	defer logMutex.Unlock()
	logLevel = strings.ToUpper(level)
	defaultConfig.Level = logLevel
}

func GetLevel() string {
	logMutex.Lock()
	defer logMutex.Unlock()
	return logLevel
}

func SetLogDirectory(dir string) {
	logMutex.Lock()
	defer logMutex.Unlock()
	logDir = dir
	defaultConfig.LogDir = dir
	if logFile != nil {
		logFile.Close()
	}
	setupFileLogging()
}

func SetMaxFileSize(size int64) {
	logMutex.Lock()
	defer logMutex.Unlock()
	maxFileSize = size
	defaultConfig.MaxFileSize = size
}

func SetMaxBackups(count int) {
	logMutex.Lock()
	defer logMutex.Unlock()
	maxBackups = count
	defaultConfig.MaxBackups = count
}

func SetOutputFormat(format string) {
	logMutex.Lock()
	defer logMutex.Unlock()
	outputFormat = format
	defaultConfig.OutputFormat = format
}

func EnableColorOutput(enable bool) {
	logMutex.Lock()
	defer logMutex.Unlock()
	enableColors = enable
	defaultConfig.EnableColors = enable
}

func WithContext(key string, value interface{}) {
	contextMutex.Lock()
	defer contextMutex.Unlock()
	contextFields[key] = value
}

func WithTraceID(traceID string) {
	WithContext("traceId", traceID)
}

func WithSpanID(spanID string) {
	WithContext("spanId", spanID)
}

func WithFields(fields map[string]interface{}) {
	contextMutex.Lock()
	defer contextMutex.Unlock()
	for k, v := range fields {
		contextFields[k] = v
	}
}

func ClearContext() {
	contextMutex.Lock()
	defer contextMutex.Unlock()
	contextFields = make(map[string]interface{})
}

func getContextFields() map[string]interface{} {
	contextMutex.RLock()
	defer contextMutex.RUnlock()
	fields := make(map[string]interface{})
	for k, v := range contextFields {
		fields[k] = v
	}
	return fields
}

func shouldLog(level string) bool {
	levels := map[string]int{
		LevelDebug: 0,
		LevelInfo:  1,
		LevelWarn:  2,
		LevelError: 3,
		LevelFatal: 4,
	}
	currentLevel := levels[logLevel]
	requestedLevel := levels[level]
	return requestedLevel >= currentLevel
}

func getCallerInfo() (file string, line int, function string) {
	pc, file, line, ok := runtime.Caller(3)
	if !ok {
		return "unknown", 0, "unknown"
	}
	fn := runtime.FuncForPC(pc)
	if fn != nil {
		function = fn.Name()
		parts := strings.Split(function, ".")
		if len(parts) > 0 {
			function = parts[len(parts)-1]
		}
	}
	parts := strings.Split(file, "/")
	if len(parts) > 0 {
		file = parts[len(parts)-1]
	}
	return file, line, function
}

func getColorCode(level string) string {
	if !enableColors {
		return ""
	}
	codes := map[string]string{
		LevelDebug: "\033[36m", // Cyan
		LevelInfo:  "\033[32m", // Green
		LevelWarn:  "\033[33m", // Yellow
		LevelError: "\033[31m", // Red
		LevelFatal: "\033[35m", // Magenta
	}
	reset := "\033[0m"
	if code, ok := codes[level]; ok {
		return code + "%s" + reset
	}
	return "%s"
}

func formatArgs(args ...interface{}) string {
	if len(args) == 0 {
		return ""
	}
	result := ""
	for i := 0; i < len(args); i += 2 {
		if i+1 < len(args) {
			result += fmt.Sprintf("%v=%v ", args[i], args[i+1])
		}
	}
	return strings.TrimSpace(result)
}

func formatFields(fields map[string]interface{}) string {
	var parts []string
	for k, v := range fields {
		parts = append(parts, fmt.Sprintf("%s=%v", k, v))
	}
	return strings.Join(parts, " ")
}

func writeLog(level, msg string, args ...interface{}) {
	if !shouldLog(level) {
		return
	}

	logMutex.Lock()
	defer logMutex.Unlock()

	entry := LogEntry{
		Timestamp: time.Now().Format(time.RFC3339Nano),
		Level:     level,
		Message:   msg,
		Fields:    make(map[string]interface{}),
	}

	// Add context fields
	for k, v := range getContextFields() {
		entry.Fields[k] = v
		if k == "traceId" {
			entry.TraceID = fmt.Sprintf("%v", v)
		}
		if k == "spanId" {
			entry.SpanID = fmt.Sprintf("%v", v)
		}
	}

	// Parse key-value pairs from args
	for i := 0; i < len(args); i += 2 {
		if i+1 < len(args) {
			key := fmt.Sprintf("%v", args[i])
			entry.Fields[key] = args[i+1]
		}
	}

	// Add caller info for debug and error levels
	if level == LevelDebug || level == LevelError || level == LevelFatal {
		entry.File, entry.Line, entry.Function = getCallerInfo()
	}

	// Format log message
	var logMsg string
	if outputFormat == "json" {
		jsonData, err := json.Marshal(entry)
		if err == nil {
			logMsg = string(jsonData)
		} else {
			logMsg = fmt.Sprintf("[%s] %s", level, msg)
		}
	} else {
		if len(entry.Fields) > 0 {
			fieldsStr := formatFields(entry.Fields)
			logMsg = fmt.Sprintf("[%s] %s %s", level, msg, fieldsStr)
		} else {
			logMsg = fmt.Sprintf("[%s] %s", level, msg)
		}
		if enableColors {
			logMsg = fmt.Sprintf(getColorCode(level), logMsg)
		}
	}

	// Write to console
	log.Println(logMsg)

	// Write structured JSON to file if enabled
	if enableFileLog && logFileWriter != nil {
		jsonData, err := json.Marshal(entry)
		if err == nil {
			fmt.Fprintln(logFileWriter, string(jsonData))
		}
	}

	// Rotate log file if needed
	if enableFileLog && logFile != nil {
		rotateLogFileIfNeeded()
	}
}

func rotateLogFileIfNeeded() {
	if logFile == nil {
		return
	}

	info, err := logFile.Stat()
	if err != nil {
		return
	}

	if info.Size() >= maxFileSize {
		logFile.Close()
		rotateFiles()
		setupFileLogging()
	}
}

func rotateFiles() {
	baseName := filepath.Join(logDir, "inventory")
	today := time.Now().Format("2006-01-02")

	// Rename existing files
	for i := maxBackups - 1; i >= 1; i-- {
		oldName := fmt.Sprintf("%s-%s.%d.log", baseName, today, i)
		newName := fmt.Sprintf("%s-%s.%d.log", baseName, today, i+1)
		if _, err := os.Stat(oldName); err == nil {
			os.Rename(oldName, newName)
		}
	}

	// Rename current log
	currentName := fmt.Sprintf("%s-%s.log", baseName, today)
	if _, err := os.Stat(currentName); err == nil {
		os.Rename(currentName, fmt.Sprintf("%s-%s.1.log", baseName, today))
	}
}

func Info(msg string, args ...interface{}) {
	writeLog(LevelInfo, msg, args...)
}

func Warn(msg string, args ...interface{}) {
	writeLog(LevelWarn, msg, args...)
}

func Debug(msg string, args ...interface{}) {
	writeLog(LevelDebug, msg, args...)
}

func Error(msg string, err error) {
	if err != nil {
		writeLog(LevelError, msg, "error", err.Error())
	} else {
		writeLog(LevelError, msg)
	}
}

func Fatal(msg string, args ...interface{}) {
	writeLog(LevelFatal, msg, args...)
	os.Exit(1)
}

func LogWithTimestamp(msg string) {
	writeLog(LevelInfo, msg)
}

func LogStructured(level, msg string, fields map[string]interface{}) {
	logMutex.Lock()
	defer logMutex.Unlock()

	entry := LogEntry{
		Timestamp: time.Now().Format(time.RFC3339Nano),
		Level:     level,
		Message:   msg,
		Fields:    fields,
	}

	// Add context
	for k, v := range getContextFields() {
		entry.Fields[k] = v
	}

	jsonData, err := json.Marshal(entry)
	if err == nil {
		if enableFileLog && logFileWriter != nil {
			fmt.Fprintln(logFileWriter, string(jsonData))
		}
		log.Println(string(jsonData))
	}
}

func LogPerformance(operation string, duration time.Duration, args ...interface{}) {
	fields := map[string]interface{}{
		"operation":   operation,
		"duration_ms": duration.Milliseconds(),
		"duration_ns": duration.Nanoseconds(),
	}
	for i := 0; i < len(args); i += 2 {
		if i+1 < len(args) {
			fields[fmt.Sprintf("%v", args[i])] = args[i+1]
		}
	}
	LogStructured(LevelInfo, "Performance metric", fields)
}

func LogHTTPRequest(method, path string, statusCode int, duration time.Duration, userID string) {
	fields := map[string]interface{}{
		"method":      method,
		"path":        path,
		"status_code": statusCode,
		"duration_ms": duration.Milliseconds(),
	}
	if userID != "" {
		fields["user_id"] = userID
	}
	LogStructured(LevelInfo, "HTTP request", fields)
}

func LogErrorWithStack(msg string, err error) {
	fields := map[string]interface{}{
		"error": err.Error(),
	}
	buf := make([]byte, 4096)
	n := runtime.Stack(buf, false)
	fields["stack"] = string(buf[:n])
	LogStructured(LevelError, msg, fields)
}

func LogBusinessEvent(eventType, description string, metadata map[string]interface{}) {
	fields := map[string]interface{}{
		"event_type":  eventType,
		"description": description,
	}
	for k, v := range metadata {
		fields[k] = v
	}
	LogStructured(LevelInfo, "Business event", fields)
}

func LogSecurityEvent(eventType, description string, severity string, metadata map[string]interface{}) {
	fields := map[string]interface{}{
		"event_type": eventType,
		"description": description,
		"severity":   severity,
	}
	for k, v := range metadata {
		fields[k] = v
	}
	level := LevelWarn
	if severity == "CRITICAL" {
		level = LevelError
	}
	LogStructured(level, "Security event", fields)
}

func LogAudit(action, resource, resourceID, userID string, success bool, details map[string]interface{}) {
	fields := map[string]interface{}{
		"action":     action,
		"resource":   resource,
		"resource_id": resourceID,
		"user_id":    userID,
		"success":    success,
	}
	for k, v := range details {
		fields[k] = v
	}
	LogStructured(LevelInfo, "Audit log", fields)
}

func LogMetrics(metricName string, value float64, tags map[string]string) {
	fields := map[string]interface{}{
		"metric": metricName,
		"value":  value,
	}
	for k, v := range tags {
		fields[k] = v
	}
	LogStructured(LevelDebug, "Metric", fields)
}

func Close() {
	logMutex.Lock()
	defer logMutex.Unlock()
	if logFile != nil {
		logFile.Close()
		logFile = nil
		enableFileLog = false
	}
}

func GetLogStats() map[string]interface{} {
	logMutex.Lock()
	defer logMutex.Unlock()
	
	stats := map[string]interface{}{
		"level":         logLevel,
		"log_dir":       logDir,
		"max_file_size": maxFileSize,
		"max_backups":   maxBackups,
		"output_format": outputFormat,
		"enable_colors": enableColors,
		"file_logging":  enableFileLog,
	}
	
	if logFile != nil {
		if info, err := logFile.Stat(); err == nil {
			stats["current_file_size"] = info.Size()
			stats["current_file_name"] = info.Name()
		}
	}
	
	return stats
}

func Flush() {
	logMutex.Lock()
	defer logMutex.Unlock()
	if logFile != nil {
		logFile.Sync()
	}
}

func NewLogger(prefix string) *CustomLogger {
	return &CustomLogger{
		prefix: prefix,
	}
}

type CustomLogger struct {
	prefix string
}

func (cl *CustomLogger) Info(msg string, args ...interface{}) {
	Info(cl.prefix+": "+msg, args...)
}

func (cl *CustomLogger) Warn(msg string, args ...interface{}) {
	Warn(cl.prefix+": "+msg, args...)
}

func (cl *CustomLogger) Debug(msg string, args ...interface{}) {
	Debug(cl.prefix+": "+msg, args...)
}

func (cl *CustomLogger) Error(msg string, err error) {
	Error(cl.prefix+": "+msg, err)
}

func (cl *CustomLogger) Fatal(msg string, args ...interface{}) {
	Fatal(cl.prefix+": "+msg, args...)
}

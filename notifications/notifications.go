package notifications

import (
	"encoding/json"
	"errors"
	"fmt"
	"inventory/logger"
	"inventory/models"
	"strings"
	"sync"
	"time"
)

type NotificationType string

const (
	NotificationTypeEmail NotificationType = "EMAIL"
	NotificationTypeSMS   NotificationType = "SMS"
	NotificationTypeWebhook NotificationType = "WEBHOOK"
	NotificationTypeSlack  NotificationType = "SLACK"
	NotificationTypePagerDuty NotificationType = "PAGERDUTY"
)

type NotificationPriority string

const (
	PriorityLow      NotificationPriority = "LOW"
	PriorityMedium   NotificationPriority = "MEDIUM"
	PriorityHigh     NotificationPriority = "HIGH"
	PriorityCritical NotificationPriority = "CRITICAL"
)

type NotificationStatus string

const (
	StatusPending   NotificationStatus = "PENDING"
	StatusSent      NotificationStatus = "SENT"
	StatusFailed    NotificationStatus = "FAILED"
	StatusCancelled NotificationStatus = "CANCELLED"
)

type Notification struct {
	ID          string            `json:"id"`
	Type        NotificationType   `json:"type"`
	Priority    NotificationPriority `json:"priority"`
	Status      NotificationStatus `json:"status"`
	Recipient   string            `json:"recipient"`
	Subject     string            `json:"subject,omitempty"`
	Message     string            `json:"message"`
	Metadata    map[string]string `json:"metadata,omitempty"`
	CreatedAt   time.Time         `json:"createdAt"`
	SentAt      time.Time         `json:"sentAt,omitempty"`
	RetryCount  int               `json:"retryCount"`
	Error       string            `json:"error,omitempty"`
}

type NotificationConfig struct {
	EmailEnabled    bool
	EmailSMTPHost   string
	EmailSMTPPort   int
	EmailUsername   string
	EmailPassword   string
	EmailFrom       string
	SMSEnabled      bool
	SMSProvider     string
	SMSAPIKey       string
	WebhookEnabled  bool
	WebhookURL      string
	SlackEnabled    bool
	SlackWebhookURL string
	MaxRetries      int
	RetryDelay      time.Duration
}

var (
	notificationQueue []models.LowStockAlert
	notifications     []Notification
	config            NotificationConfig
	mu                sync.Mutex
	subscribers       []NotificationSubscriber
	subscriberMutex   sync.RWMutex
)

type NotificationSubscriber interface {
	Notify(notification Notification) error
	GetType() NotificationType
}

func Configure(cfg NotificationConfig) {
	mu.Lock()
	defer mu.Unlock()
	config = cfg
	logger.Info("Notification system configured", 
		"email_enabled", cfg.EmailEnabled,
		"sms_enabled", cfg.SMSEnabled,
		"webhook_enabled", cfg.WebhookEnabled,
	)
}

func GetConfig() NotificationConfig {
	mu.Lock()
	defer mu.Unlock()
	return config
}

func SendLowStockAlert(alert models.LowStockAlert) {
	mu.Lock()
	notificationQueue = append(notificationQueue, alert)
	mu.Unlock()

	logger.Info("Low stock alert queued", 
		"sku", alert.SKU,
		"available", alert.Available,
		"threshold", alert.Threshold,
	)

	// Process alert immediately
	go processLowStockAlert(alert)
}

func processLowStockAlert(alert models.LowStockAlert) {
	priority := determinePriority(alert)
	
	// Create notification for each enabled channel
	if config.EmailEnabled {
		notif := Notification{
			ID:        generateNotificationID(),
			Type:      NotificationTypeEmail,
			Priority:  priority,
			Status:    StatusPending,
			Recipient: getEmailRecipient(),
			Subject:   fmt.Sprintf("Low Stock Alert: %s", alert.SKU),
			Message:   formatLowStockMessage(alert),
			CreatedAt: time.Now(),
		}
		sendNotification(notif)
	}

	if config.SMSEnabled && priority == PriorityCritical {
		notif := Notification{
			ID:        generateNotificationID(),
			Type:      NotificationTypeSMS,
			Priority:  priority,
			Status:    StatusPending,
			Recipient: getSMSRecipient(),
			Message:   formatLowStockSMS(alert),
			CreatedAt: time.Now(),
		}
		sendNotification(notif)
	}

	if config.WebhookEnabled {
		notif := Notification{
			ID:        generateNotificationID(),
			Type:      NotificationTypeWebhook,
			Priority:  priority,
			Status:    StatusPending,
			Recipient: config.WebhookURL,
			Message:   formatLowStockJSON(alert),
			CreatedAt: time.Now(),
		}
		sendNotification(notif)
	}

	if config.SlackEnabled {
		notif := Notification{
			ID:        generateNotificationID(),
			Type:      NotificationTypeSlack,
			Priority:  priority,
			Status:    StatusPending,
			Recipient: config.SlackWebhookURL,
			Message:   formatLowStockSlack(alert),
			CreatedAt: time.Now(),
		}
		sendNotification(notif)
	}

	// Notify subscribers
	notifySubscribers(alert)
}

func determinePriority(alert models.LowStockAlert) NotificationPriority {
	if alert.Threshold == 0 {
		return PriorityMedium
	}
	percentage := float64(alert.Available) / float64(alert.Threshold) * 100
	if percentage <= 25 {
		return PriorityCritical
	} else if percentage <= 50 {
		return PriorityHigh
	} else if percentage <= 75 {
		return PriorityMedium
	}
	return PriorityLow
}

func formatLowStockMessage(alert models.LowStockAlert) string {
	return fmt.Sprintf(
		"Low Stock Alert\n\nSKU: %s\nAvailable: %d\nThreshold: %d\nAlert Level: %s\n\nPlease review and reorder if necessary.",
		alert.SKU, alert.Available, alert.Threshold, alert.GetAlertLevel(),
	)
}

func formatLowStockSMS(alert models.LowStockAlert) string {
	return fmt.Sprintf("LOW STOCK: %s - %d available (threshold: %d)", 
		alert.SKU, alert.Available, alert.Threshold)
}

func formatLowStockJSON(alert models.LowStockAlert) string {
	data, _ := json.Marshal(alert)
	return string(data)
}

func formatLowStockSlack(alert models.LowStockAlert) string {
	level := alert.GetAlertLevel()
	emoji := ":warning:"
	if level == "CRITICAL" {
		emoji = ":rotating_light:"
	}
	return fmt.Sprintf("%s *Low Stock Alert*\n*SKU:* %s\n*Available:* %d\n*Threshold:* %d\n*Level:* %s",
		emoji, alert.SKU, alert.Available, alert.Threshold, level)
}

func sendNotification(notif Notification) {
	mu.Lock()
	notifications = append(notifications, notif)
	mu.Unlock()

	var err error
	switch notif.Type {
	case NotificationTypeEmail:
		err = SendEmailAlert(models.LowStockAlert{SKU: notif.Message})
	case NotificationTypeSMS:
		err = SendSMSAlert(models.LowStockAlert{SKU: notif.Message})
	case NotificationTypeWebhook:
		err = SendWebhookAlert(notif)
	case NotificationTypeSlack:
		err = SendSlackAlert(notif)
	default:
		err = errors.New("unknown notification type")
	}

	mu.Lock()
	defer mu.Unlock()
	for i := range notifications {
		if notifications[i].ID == notif.ID {
			if err != nil {
				notifications[i].Status = StatusFailed
				notifications[i].Error = err.Error()
				if notifications[i].RetryCount < config.MaxRetries {
					go retryNotification(notifications[i])
				}
			} else {
				notifications[i].Status = StatusSent
				notifications[i].SentAt = time.Now()
			}
			break
		}
	}
}

func retryNotification(notif Notification) {
	time.Sleep(config.RetryDelay)
	notif.RetryCount++
	sendNotification(notif)
}

func generateNotificationID() string {
	return fmt.Sprintf("notif-%d", time.Now().UnixNano())
}

func getEmailRecipient() string {
	if config.EmailFrom != "" {
		return config.EmailFrom
	}
	return "admin@inventory.com"
}

func getSMSRecipient() string {
	return "+1234567890" // Default SMS recipient
}

func GetPendingNotifications() []models.LowStockAlert {
	mu.Lock()
	defer mu.Unlock()
	return notificationQueue
}

func ClearNotifications() {
	mu.Lock()
	defer mu.Unlock()
	notificationQueue = []models.LowStockAlert{}
}

func GetNotificationHistory(limit int) []Notification {
	mu.Lock()
	defer mu.Unlock()
	if limit <= 0 || limit > len(notifications) {
		return notifications
	}
	return notifications[len(notifications)-limit:]
}

func GetFailedNotifications() []Notification {
	mu.Lock()
	defer mu.Unlock()
	var failed []Notification
	for _, n := range notifications {
		if n.Status == StatusFailed {
			failed = append(failed, n)
		}
	}
	return failed
}

func RetryFailedNotifications() {
	failed := GetFailedNotifications()
	for _, notif := range failed {
		if notif.RetryCount < config.MaxRetries {
			go retryNotification(notif)
		}
	}
}

func SendEmailAlert(alert models.LowStockAlert) error {
	if !config.EmailEnabled {
		return errors.New("email notifications not enabled")
	}
	logger.Info("Sending email alert", "sku", alert.SKU)
	// In production, this would use SMTP
	return nil
}

func SendSMSAlert(alert models.LowStockAlert) error {
	if !config.SMSEnabled {
		return errors.New("SMS notifications not enabled")
	}
	logger.Info("Sending SMS alert", "sku", alert.SKU)
	// In production, this would use SMS API
	return nil
}

func SendWebhookAlert(notif Notification) error {
	if !config.WebhookEnabled {
		return errors.New("webhook notifications not enabled")
	}
	logger.Info("Sending webhook notification", 
		"url", config.WebhookURL,
		"type", notif.Type,
	)
	// In production, this would POST to webhook URL
	return nil
}

func SendSlackAlert(notif Notification) error {
	if !config.SlackEnabled {
		return errors.New("slack notifications not enabled")
	}
	logger.Info("Sending Slack notification", 
		"webhook", config.SlackWebhookURL,
	)
	// In production, this would POST to Slack webhook
	return nil
}

func SendCustomNotification(notif Notification) error {
	if err := ValidateNotification(notif); err != nil {
		return err
	}
	sendNotification(notif)
	return nil
}

func RegisterSubscriber(subscriber NotificationSubscriber) {
	subscriberMutex.Lock()
	defer subscriberMutex.Unlock()
	subscribers = append(subscribers, subscriber)
	logger.Info("Notification subscriber registered", "type", subscriber.GetType())
}

func UnregisterSubscriber(subscriberType NotificationType) {
	subscriberMutex.Lock()
	defer subscriberMutex.Unlock()
	for i, sub := range subscribers {
		if sub.GetType() == subscriberType {
			subscribers = append(subscribers[:i], subscribers[i+1:]...)
			break
		}
	}
}

func notifySubscribers(alert models.LowStockAlert) {
	subscriberMutex.RLock()
	defer subscriberMutex.RUnlock()
	
	for _, subscriber := range subscribers {
		go func(sub NotificationSubscriber) {
			notif := Notification{
				ID:        generateNotificationID(),
				Type:      sub.GetType(),
				Priority:  determinePriority(alert),
				Status:    StatusPending,
				Message:   formatLowStockJSON(alert),
				CreatedAt: time.Now(),
			}
			if err := sub.Notify(notif); err != nil {
				logger.Error("Subscriber notification failed", err)
			}
		}(subscriber)
	}
}

func GetNotificationStats() map[string]interface{} {
	mu.Lock()
	defer mu.Unlock()
	
	stats := map[string]interface{}{
		"total_notifications": len(notifications),
		"pending_queue":       len(notificationQueue),
		"email_enabled":       config.EmailEnabled,
		"sms_enabled":         config.SMSEnabled,
		"webhook_enabled":     config.WebhookEnabled,
		"slack_enabled":       config.SlackEnabled,
	}
	
	sent := 0
	failed := 0
	pending := 0
	for _, n := range notifications {
		switch n.Status {
		case StatusSent:
			sent++
		case StatusFailed:
			failed++
		case StatusPending:
			pending++
		}
	}
	
	stats["sent"] = sent
	stats["failed"] = failed
	stats["pending"] = pending
	
	return stats
}

func CleanupOldNotifications(olderThan time.Duration) {
	mu.Lock()
	defer mu.Unlock()
	
	cutoff := time.Now().Add(-olderThan)
	var filtered []Notification
	for _, n := range notifications {
		if n.CreatedAt.After(cutoff) {
			filtered = append(filtered, n)
		}
	}
	notifications = filtered
	logger.Info("Cleaned up old notifications", 
		"removed", len(notifications)-len(filtered),
		"remaining", len(filtered),
	)
}

func GetNotificationsByType(notifType NotificationType) []Notification {
	mu.Lock()
	defer mu.Unlock()
	var result []Notification
	for _, n := range notifications {
		if n.Type == notifType {
			result = append(result, n)
		}
	}
	return result
}

func GetNotificationsByPriority(priority NotificationPriority) []Notification {
	mu.Lock()
	defer mu.Unlock()
	var result []Notification
	for _, n := range notifications {
		if n.Priority == priority {
			result = append(result, n)
		}
	}
	return result
}

func GetNotificationsByStatus(status NotificationStatus) []Notification {
	mu.Lock()
	defer mu.Unlock()
	var result []Notification
	for _, n := range notifications {
		if n.Status == status {
			result = append(result, n)
		}
	}
	return result
}

func CancelNotification(notificationID string) error {
	mu.Lock()
	defer mu.Unlock()
	
	for i := range notifications {
		if notifications[i].ID == notificationID {
			if notifications[i].Status == StatusPending {
				notifications[i].Status = StatusCancelled
				return nil
			}
			return errors.New("cannot cancel notification that is not pending")
		}
	}
	return errors.New("notification not found")
}

func BatchSendNotifications(notifs []Notification) []error {
	var errs []error
	for _, notif := range notifs {
		if err := ValidateNotification(notif); err != nil {
			errs = append(errs, err)
			continue
		}
		sendNotification(notif)
	}
	return errs
}

func SetNotificationPriority(notificationID string, priority NotificationPriority) error {
	mu.Lock()
	defer mu.Unlock()
	
	for i := range notifications {
		if notifications[i].ID == notificationID {
			notifications[i].Priority = priority
			return nil
		}
	}
	return errors.New("notification not found")
}

func GetNotificationByID(notificationID string) (*Notification, error) {
	mu.Lock()
	defer mu.Unlock()
	
	for i := range notifications {
		if notifications[i].ID == notificationID {
			return &notifications[i], nil
		}
	}
	return nil, errors.New("notification not found")
}

func ValidateNotification(notif Notification) error {
	if notif.Type == "" {
		return errors.New("notification type is required")
	}
	if notif.Recipient == "" {
		return errors.New("recipient is required")
	}
	if notif.Message == "" {
		return errors.New("message is required")
	}
	return nil
}

func FormatNotificationTemplate(template string, data map[string]interface{}) string {
	result := template
	for k, v := range data {
		placeholder := fmt.Sprintf("{{%s}}", k)
		result = strings.ReplaceAll(result, placeholder, fmt.Sprintf("%v", v))
	}
	return result
}

func ScheduleNotification(notif Notification, delay time.Duration) {
	go func() {
		time.Sleep(delay)
		sendNotification(notif)
	}()
}

func GetNotificationMetrics() map[string]interface{} {
	stats := GetNotificationStats()
	
	mu.Lock()
	defer mu.Unlock()
	
	metrics := map[string]interface{}{
		"total_processed": len(notifications),
		"queue_size":      len(notificationQueue),
		"subscribers":     len(subscribers),
	}
	
	for k, v := range stats {
		metrics[k] = v
	}
	
	return metrics
}

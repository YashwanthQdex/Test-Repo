package notifications

import "inventory/models"

var notificationQueue []models.LowStockAlert

func SendLowStockAlert(alert models.LowStockAlert) {
	notificationQueue = append(notificationQueue, alert)
	// In production, this would send to email/SMS/webhook
}

func GetPendingNotifications() []models.LowStockAlert {
	return notificationQueue
}

func ClearNotifications() {
	notificationQueue = []models.LowStockAlert{}
}

func SendEmailAlert(alert models.LowStockAlert) error {
	// Placeholder for email notification
	return nil
}

func SendSMSAlert(alert models.LowStockAlert) error {
	// Placeholder for SMS notification
	return nil
}


class NotificationModule {
  showNotification(message, type = 'info', duration = 3000) {
    const container = document.getElementById('notifications');
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;

    container.appendChild(notification);

    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease-in forwards';
      setTimeout(() => notification.remove(), 300);
    }, duration);
  }

  success(message, duration = 3000) {
    this.showNotification(message, 'success', duration);
  }

  error(message, duration = 4000) {
    this.showNotification(message, 'error', duration);
  }

  warning(message, duration = 3500) {
    this.showNotification(message, 'warning', duration);
  }

  info(message, duration = 3000) {
    this.showNotification(message, 'info', duration);
  }
}

const notificationModule = new NotificationModule();

export function showNotification(message, type = 'info') {
  notificationModule.showNotification(message, type);
}

export function success(message) {
  notificationModule.success(message);
}

export function error(message) {
  notificationModule.error(message);
}

export function warning(message) {
  notificationModule.warning(message);
}
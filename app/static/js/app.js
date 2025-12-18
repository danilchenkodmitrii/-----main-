import { initializeAuth, getCurrentUser, logout, isAdmin, getAllUsers, setCurrentUser, createUser, loginWithPassword } from './auth.js';
import { showNotification } from './notifications.js';

class SoveshaikaApp {
  constructor() {
    this.currentUser = null;
    this.rooms = [];
    this.bookings = [];
    this.users = [];
    this.allUsers = [];
    this.timeSlots = this.generateTimeSlots();
    this.ws = null;
    this.pollingInterval = null;
    this.isProcessingLogin = false;
    this.isInitialized = false;
        
    document.addEventListener('DOMContentLoaded', () => {
        if (!this.isInitialized) {
            this.init();
            this.isInitialized = true;
        }
    });
}
async init() {
    // Если уже инициализирован, выходим
    if (this.isInitialized) {
        console.log("⚠️ Приложение уже инициализировано");
        return;
    }
    
    console.log("🚀 Инициализация приложения...");
    
    // 1. Проверяем авторизацию
    const isAuthenticated = await this.checkAuthAndLoad();
    
    // Добавляем анимации для модальных окон
    this.addModalAnimations();
    
    // 2. Инициализируем аутентификацию
    await initializeAuth();
    
    // 3. Получаем данные
    this.currentUser = getCurrentUser();
    this.users = getAllUsers();
    
    // 4. Генерируем временные слоты
    this.timeSlots = this.generateTimeSlots();
    
    // 5. Настраиваем обработчики
    this.bindEvents();
    
    // 6. Переходим на нужную страницу
    if (isAuthenticated && this.currentUser) {
        console.log(`✅ Авторизован как ${this.currentUser.name}`);
        this.switchView('home');
    } else {
        console.log("🔑 Не авторизован, показываем форму входа");
        this.switchView('auth');
    }
    
    this.isInitialized = true;
    console.log("✅ Приложение инициализировано");
}
isAdmin() {
    return this.currentUser?.role === 'admin';
}

isManager() {
    return this.currentUser?.role === 'manager';
}

isAdminOrManager() {
    return this.isAdmin() || this.isManager();
}
stopPolling() {
    if (this.pollingInterval) {
        clearInterval(this.pollingInterval);
        this.pollingInterval = null;
        console.log("✅ Опрос сервера остановлен");
    }
}
startPolling() {
    this.stopPolling(); // Останавливаем предыдущий интервал
    
    this.pollingInterval = setInterval(async () => {
        if (this.currentUser) {
            console.log('🔄 Автообновление данных...');
            await this.loadRooms();
            
            if (document.getElementById('dashboard')?.classList.contains('active')) {
                await this.updateDashboard();
            }
        }
    }, 30000); // 30 секунд
}
generateTimeSlots() {
    console.log("🕒 Генерация временных слотов...");
    const slots = [];
    
    // Создаем слоты с 9:00 до 18:00 с шагом 30 минут
    for (let hour = 9; hour <= 18; hour++) {
        for (let minute of ['00', '30']) {
            // Пропускаем 18:30 так как рабочий день до 18:00
            if (hour === 18 && minute === '30') continue;
            
            const time = `${hour.toString().padStart(2, '0')}:${minute}`;
            const display = `${hour}:${minute}`;
            slots.push({ time, display });
        }
    }
    
    console.log(`✅ Сгенерировано ${slots.length} временных слотов`);
    return slots;
}
async loginUser(email, password) {
    try {
        const response = await fetch('/api/users/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        if (response.ok) {
            const user = await response.json();
            this.currentUser = user;
            
            // Сохраняем в localStorage
            localStorage.setItem('soveshaika_user', JSON.stringify(user));
            
            // Сохраняем в историю использованных аккаунтов
            this.saveUsedAccount(user.id, user);
            
            // Обновляем UI
            this.updateUserDisplay();
            
            // Загружаем данные
            await this.loadRooms();
            
            // Переключаемся на главную
            this.switchView('home');
            
            // Показываем уведомление
            showNotification(`Вход выполнен как ${user.name}`, 'success');
        } else {
            const error = await response.json();
            showNotification(error.detail || 'Ошибка входа', 'error');
        }
    } catch (error) {
        showNotification('Ошибка сети при входе', 'error');
        }
    }
    updateUI() {
        console.log("🔄 Обновление интерфейса...");
        
        if (this.currentUser) {
            // Обновляем имя пользователя
            const userNameElement = document.querySelector('.user-name');
            if (userNameElement) {
                userNameElement.textContent = this.currentUser.name || 'Пользователь';
            }
            
            // Показываем/скрываем кнопку администратора
            const adminBtn = document.querySelector('[data-view="admin"]');
            if (adminBtn) {
                if (this.currentUser.role === 'admin' || this.currentUser.role === 'manager') {
                    adminBtn.style.display = 'inline-block';
                } else {
                    adminBtn.style.display = 'none';
                }
            }
            
            // Обновляем профиль если он активен
            if (document.getElementById('profile')?.classList.contains('active')) {
                this.updateProfile();
            }
            
            console.log("✅ Интерфейс обновлен для пользователя:", this.currentUser.name);
        } else {
            console.log("ℹ️ Нет текущего пользователя для обновления UI");
        }
    }
    async initializeAuth() {
        console.log("🔐 Инициализация аутентификации...");
        
        try {
            // Пробуем загрузить пользователей с сервера
            const response = await fetch(`${API_BASE}/`);
            if (response.ok) {
                this.users = await response.json();
                console.log(`✅ Загружено ${this.users.length} пользователей`);
            } else {
                console.warn('⚠️ Не удалось загрузить пользователей, используем пустой список');
                this.users = [];
            }
        } catch (error) {
            console.error('❌ Ошибка загрузки пользователей:', error);
            // Запасные данные для демонстрации
            this.users = [];
        }
    }
    async init() {
        console.log("🚀 Инициализация приложения...");
        
        // ⭐⭐⭐ ПЕРВОЕ: проверяем авторизацию ДО загрузки пользователей ⭐⭐⭐
        await this.checkAuthAndLoad();
        
        // ⭐⭐⭐ ВТОРОЕ: инициализируем аутентификацию ⭐⭐⭐
        await initializeAuth();
        
        // ⭐⭐⭐ ТРЕТЬЕ: получаем данные пользователей ⭐⭐⭐
        this.currentUser = getCurrentUser();
        this.users = getAllUsers();
        
        // ⭐⭐⭐ ЧЕТВЕРТОЕ: настраиваем обработчики ⭐⭐⭐
        this.bindEvents();
        
        // Если пользователь авторизован, загружаем данные
        if (this.currentUser) {
            this.updateUserDisplay();
            await this.loadRooms();
            this.switchView('home');
        } else {
            // Если не авторизован, показываем форму входа
            this.switchView('auth');
        }
        
        console.log("✅ Инициализация завершена");
    }
    
    async checkAuthAndLoad() {
        console.log("🔐 Проверка авторизации...");
        
        try {
            // Проверяем localStorage
            const userData = localStorage.getItem('soveshaika_user');
            
            if (userData) {
                console.log("📦 Найден пользователь в localStorage");
                
                try {
                    const user = JSON.parse(userData);
                    this.currentUser = user;
                    
                    console.log(`👤 Пользователь восстановлен: ${user.name}`);
                    
                    // Обновляем UI
                    this.updateUI();
                    
                    // Загружаем данные
                    await this.loadInitialData();
                    
                    // Успешная авторизация
                    return true;
                    
                } catch (parseError) {
                    console.error("❌ Ошибка парсинга данных пользователя:", parseError);
                    localStorage.removeItem('soveshaika_user');
                    this.currentUser = null;
                    return false;
                }
                
            } else {
                console.log("📦 Пользователь не найден в localStorage");
                this.currentUser = null;
                return false;
            }
            
        } catch (error) {
            console.error('❌ Ошибка проверки авторизации:', error);
            localStorage.removeItem('soveshaika_user');
            this.currentUser = null;
            return false;
        }
    }
    
    async loadInitialData() {
        console.log("📦 Загрузка начальных данных...");
        
        try {
            await Promise.all([
                this.loadRooms(),
                this.loadAuthUsers()
            ]);
            
            console.log("✅ Начальные данные загружены");
        } catch (error) {
            console.error("❌ Ошибка загрузки данных:", error);
        }
    }
    async loadRooms() {
        console.log("🏢 Загрузка комнат...");
        try {
            const response = await fetch('/api/rooms/');
            if (response.ok) {
                this.rooms = await response.json();
                console.log(`✅ Загружено ${this.rooms.length} комнат`);
            } else {
                console.error('❌ Ошибка загрузки комнат:', response.status);
                this.rooms = [];
            }
        } catch (error) {
            console.error('❌ Ошибка сети при загрузке комнат:', error);
            this.rooms = [];
        }
    }

    showAuthView() {
        this.switchView('auth');
    }

    showNotification(message, type = 'info') {
        console.log(`🔔 ${type.toUpperCase()}: ${message}`);
        
        const container = document.getElementById('notifications');
        if (!container) {
            console.error('❌ Контейнер уведомлений не найден');
            return;
        }
        
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        container.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-in forwards';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    loadAuthUsersList() {
        const list = document.getElementById('authUsersList');
        const users = this.users;
        list.innerHTML = '';

        if (users.length === 0) {
            list.innerHTML = '<p class="text-muted">Нет пользователей</p>';
            return;
        }

        users.forEach(user => {
            const button = document.createElement('button');
            button.className = 'auth-user-btn';
            button.innerHTML = `
                <div class="auth-user-info">
                    <div class="auth-user-name">${user.name}</div>
                    <div class="auth-user-email">${user.email}</div>
                    <div class="auth-user-role">${this.getRoleLabel(user.role)}</div>
                </div>
            `;
            button.addEventListener('click', () => {
                this.loginUser(user.email, 'password123');
            });
            list.appendChild(button);
        });
    }

    async loadRoomsForAdmin() {
        console.log("🏢 Загрузка комнат для админ-панели...");
        
        // Проверяем, активна ли вкладка комнат
        const roomsTab = document.getElementById('rooms-tab');
        if (!roomsTab || !roomsTab.classList.contains('active')) {
            console.log('⚠️ Вкладка комнат не активна, загрузка отложена');
            return;
        }
        
        try {
            const response = await fetch('/api/rooms/');
            if (response.ok) {
                this.rooms = await response.json();
                
                // Дополнительная проверка перед рендерингом
                setTimeout(() => {
                    this.renderRoomsList();
                }, 50);
            } else {
                this.showNotification('Ошибка загрузки комнат', 'error');
            }
        } catch (error) {
            console.error('Error loading rooms:', error);
            this.showNotification('Ошибка сети', 'error');
        }
    }

    renderRoomsList() {
        const container = document.getElementById('roomsList');
        if (!container) {
            console.error('❌ Элемент roomsList не найден. Проверьте HTML структуру.');
            
            // Пытаемся найти элемент после небольшой задержки
            setTimeout(() => {
                const retryContainer = document.getElementById('roomsList');
                if (retryContainer) {
                    console.log('✅ Элемент roomsList найден после задержки');
                    this.renderRoomsList();
                } else {
                    console.error('❌ Элемент roomsList все еще не найден. Проверьте:');
                    console.error('1. ID элемента в HTML должен быть "roomsList"');
                    console.error('2. Элемент должен находиться в #rooms-tab');
                }
            }, 100);
            return;
        }
        
        console.log(`🏢 Отрисовка ${this.rooms.length} комнат для админки`);
        container.innerHTML = '';
        
        if (this.rooms.length === 0) {
            container.innerHTML = '<p class="text-muted">Нет комнат</p>';
            return;
        }
        
        this.rooms.forEach(room => {
            const roomElement = document.createElement('div');
            roomElement.className = 'list-item';
            roomElement.innerHTML = `
                <div class="item-info">
                    <h4>${room.name}</h4>
                    <p>
                        👥 ${room.capacity} чел. • 
                        💰 ${room.price} руб/час •
                        📅 Создана: ${new Date(room.createdAt).toLocaleDateString('ru-RU')}
                    </p>
                    ${room.amenities ? `<p><small>🛠️ ${room.amenities}</small></p>` : ''}
                </div>
                <div class="item-actions">
                    <button class="btn btn-danger btn-small" onclick="window.app.deleteRoom('${room.id}')">
                        Удалить
                    </button>
                </div>
            `;
            container.appendChild(roomElement);
        });
    }
    async addRoom() {
        console.log("🏗️ Добавление новой комнаты...");
        
        // Получаем значения из формы
        const nameInput = document.getElementById('roomName');
        const capacityInput = document.getElementById('roomCapacity');
        const priceInput = document.getElementById('roomPrice');
        const amenitiesInput = document.getElementById('roomAmenities');
        
        if (!nameInput || !capacityInput || !priceInput) {
            this.showNotification('Не найдены элементы формы', 'error');
            console.error("❌ Элементы формы не найдены:", { 
                nameInput: !!nameInput, 
                capacityInput: !!capacityInput, 
                priceInput: !!priceInput 
            });
            return;
        }
        
        const name = nameInput.value.trim();
        const capacity = capacityInput.value;
        const price = priceInput.value;
        const amenities = amenitiesInput ? amenitiesInput.value.trim() : '';
        
        // Валидация
        if (!name) {
            this.showNotification('Введите название комнаты', 'error');
            nameInput.focus();
            return;
        }
        
        if (!capacity || capacity < 1) {
            this.showNotification('Введите корректную вместимость', 'error');
            capacityInput.focus();
            return;
        }
        
        if (!price || price < 0) {
            this.showNotification('Введите корректную цену', 'error');
            priceInput.focus();
            return;
        }
        
        try {
            const response = await fetch('/api/rooms/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: name,
                    capacity: parseInt(capacity),
                    price: parseFloat(price),
                    amenities: amenities || ''
                })
            });
            
            if (response.ok) {
                const room = await response.json();
                this.showNotification(`Комната "${room.name}" добавлена за ${room.price} руб/час`, 'success');
                
                // Очищаем форму
                nameInput.value = '';
                capacityInput.value = '';
                priceInput.value = '0';
                if (amenitiesInput) amenitiesInput.value = '';
                
                // Обновляем список комнат
                await this.loadRoomsForAdmin();
                
                // Если мы на dashboard, обновляем его
                if (document.getElementById('dashboard')?.classList.contains('active')) {
                    await this.updateDashboard();
                }
                
            } else {
                const error = await response.json();
                this.showNotification(error.detail || 'Ошибка добавления комнаты', 'error');
            }
        } catch (error) {
            console.error('Error adding room:', error);
            this.showNotification('Ошибка сети', 'error');
        }
    }
    async viewUserDetails(userId) {
        console.log(`🔍 Загрузка деталей пользователя: ${userId}`);
        
        try {
            // Показываем индикатор загрузки
            this.showNotification('Загрузка данных пользователя...', 'info');
            
            const response = await fetch(`/api/users/${userId}`);
            if (response.ok) {
                const user = await response.json();
                this.showUserDetailsModal(user);
            } else {
                const error = await response.json();
                this.showNotification(`Ошибка: ${error.detail || 'Не удалось загрузить данные'}`, 'error');
            }
        } catch (error) {
            console.error('Error loading user details:', error);
            this.showNotification('Ошибка сети при загрузке данных', 'error');
        }
    }
    
    showUserDetailsModal(user) {
        console.log('🔄 Создание модального окна для пользователя:', user.name);
        
        // Закрываем предыдущее модальное окно если есть
        const existingModal = document.getElementById('userDetailsModalContainer');
        if (existingModal) {
            existingModal.remove();
        }
        
        // Определяем количество бронирований пользователя
        const userBookings = this.bookings?.filter(b => b.userId === user.id) || [];
        
        const modalHtml = `
            <div class="modal-overlay active" id="userDetailsModal">
                <div class="modal-content user-modal">
                    <div class="modal-header">
                        <h3>${user.name}</h3>
                        <button class="modal-close" onclick="window.app.closeUserDetailsModal()">×</button>
                    </div>
                    <div class="modal-body">
                        <div class="user-avatar">
                            <div class="avatar-placeholder">${user.name.charAt(0).toUpperCase()}</div>
                        </div>
                        
                        <div class="user-info-grid">
                            <div class="info-item">
                                <span class="label">ID:</span>
                                <span class="value"><code>${user.id}</code></span>
                            </div>
                            <div class="info-item">
                                <span class="label">Email:</span>
                                <span class="value">${user.email}</span>
                            </div>
                            <div class="info-item">
                                <span class="label">Роль:</span>
                                <span class="value role-badge ${user.role}">${this.getRoleLabel(user.role)}</span>
                            </div>
                            <div class="info-item">
                                <span class="label">Зарегистрирован:</span>
                                <span class="value">${new Date(user.createdAt).toLocaleDateString('ru-RU', {
                                    day: 'numeric',
                                    month: 'long',
                                    year: 'numeric'
                                })}</span>
                            </div>
                            <div class="info-item">
                                <span class="label">Бронирований:</span>
                                <span class="value">${userBookings.length}</span>
                            </div>
                        </div>
                        
                        ${userBookings.length > 0 ? `
                            <div class="user-bookings">
                                <h4>Последние бронирования</h4>
                                <div class="bookings-list-mini">
                                    ${userBookings.slice(0, 3).map(booking => `
                                        <div class="booking-item-mini">
                                            <strong>${booking.title}</strong>
                                            <div class="booking-details-mini">
                                                <span class="booking-date">${booking.date}</span>
                                                <span class="booking-time">${booking.startTime}-${booking.endTime}</span>
                                            </div>
                                        </div>
                                    `).join('')}
                                </div>
                                ${userBookings.length > 3 ? 
                                    `<p class="text-muted">И еще ${userBookings.length - 3} бронирований...</p>` : ''}
                            </div>
                        ` : ''}
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="window.app.closeUserDetailsModal()">
                            Закрыть
                        </button>
                        <button class="btn btn-primary" onclick="window.app.editUserRole('${user.id}')">
                            Изменить роль
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        const modalContainer = document.createElement('div');
        modalContainer.id = 'userDetailsModalContainer';
        modalContainer.innerHTML = modalHtml;
        document.body.appendChild(modalContainer);
        
        // Добавляем стили если их еще нет
        this.addUserModalStyles();
    }
    closeUserDetailsModal() {
        const modalContainer = document.getElementById('userDetailsModalContainer');
        if (modalContainer) {
            // Добавляем анимацию закрытия
            const modal = modalContainer.querySelector('.modal-overlay');
            if (modal) {
                modal.style.animation = 'fadeOut 0.3s ease forwards';
                
                // Ждем завершения анимации перед удалением
                setTimeout(() => {
                    modalContainer.remove();
                }, 300);
            } else {
                modalContainer.remove();
            }
        }
        
        // Также удаляем стили если больше нет модальных окон
        this.cleanupModalStyles();
    }
    
    cleanupModalStyles() {
        // Проверяем, есть ли еще модальные окна
        const hasOtherModals = document.querySelectorAll('.modal-overlay').length > 0;
        
        if (!hasOtherModals) {
            // Можно удалить стили, но лучше оставить для будущих модальных окон
            // const styles = document.getElementById('user-modal-styles');
            // if (styles) styles.remove();
        }
    }
    
    // Добавьте анимацию закрытия в CSS
    addModalAnimations() {
        const animationStyles = `
            @keyframes fadeOut {
                from { opacity: 1; }
                to { opacity: 0; }
            }
        `;
        
        // Проверяем, есть ли уже эта анимация
        if (!document.getElementById('modal-animations')) {
            const styleElement = document.createElement('style');
            styleElement.id = 'modal-animations';
            styleElement.textContent = animationStyles;
            document.head.appendChild(styleElement);
        }
    }
    
    addUserModalStyles() {
        // Проверяем, добавлены ли стили уже
        if (document.getElementById('user-modal-styles')) return;
        
        const styles = `
            /* Стили для модального окна пользователя */
            .user-modal {
                max-width: 600px !important;
                width: 90% !important;
                margin: 20px auto !important;
                max-height: 85vh !important;
                overflow-y: auto !important;
            }
            
            .user-avatar {
                text-align: center;
                margin-bottom: 1.5rem;
            }
            
            .avatar-placeholder {
                width: 80px;
                height: 80px;
                background: linear-gradient(135deg, var(--primary-color), var(--primary-hover));
                border-radius: 50%;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                font-size: 2rem;
                font-weight: 600;
                color: white;
                margin: 0 auto;
            }
            
            .user-info-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                gap: 1.25rem;
                margin-bottom: 2rem;
                background: #f8fafc;
                padding: 1.5rem;
                border-radius: 12px;
                border: 1px solid var(--border-color);
            }
            
            .info-item {
                display: flex;
                flex-direction: column;
                gap: 0.5rem;
                min-width: 0; /* Для корректного переноса длинного текста */
            }
            
            .info-item .label {
                font-weight: 500;
                color: var(--text-secondary);
                font-size: 0.85rem;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            
            .info-item .value {
                color: var(--text-color);
                font-size: 1rem;
                font-weight: 500;
                word-break: break-word; /* Для переноса длинных ID и email */
                line-height: 1.4;
            }
            
            .info-item .value code {
                background: var(--background-color);
                padding: 0.4rem 0.75rem;
                border-radius: 6px;
                font-family: 'Consolas', 'Monaco', monospace;
                font-size: 0.85rem;
                display: inline-block;
                max-width: 100%;
                overflow: hidden;
                text-overflow: ellipsis;
                border: 1px solid #e5e7eb;
            }
            
            .role-badge {
                display: inline-block;
                padding: 0.35rem 1rem;
                border-radius: 1.5rem;
                font-size: 0.85rem;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                min-width: 120px;
                text-align: center;
            }
            
            .role-badge.user {
                background: linear-gradient(135deg, #e0f2fe, #bae6fd);
                color: #0369a1;
                border: 1px solid #7dd3fc;
            }
            
            .role-badge.manager {
                background: linear-gradient(135deg, #fef3c7, #fde68a);
                color: #92400e;
                border: 1px solid #fcd34d;
            }
            
            .role-badge.admin {
                background: linear-gradient(135deg, #dcfce7, #bbf7d0);
                color: #166534;
                border: 1px solid #86efac;
            }
            
            .user-bookings {
                margin-top: 2rem;
                padding-top: 1.5rem;
                border-top: 1px solid var(--border-color);
            }
            
            .user-bookings h4 {
                margin-bottom: 1.25rem;
                color: var(--text-color);
                font-size: 1.25rem;
                font-weight: 600;
                padding-bottom: 0.75rem;
                border-bottom: 2px solid var(--primary-color);
            }
            
            .bookings-list-mini {
                display: flex;
                flex-direction: column;
                gap: 1rem;
                margin-bottom: 1.5rem;
            }
            
            .booking-item-mini {
                background: white;
                padding: 1.25rem;
                border-radius: 10px;
                border-left: 4px solid var(--primary-color);
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
                transition: transform 0.2s, box-shadow 0.2s;
            }
            
            .booking-item-mini:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
            }
            
            .booking-item-mini strong {
                display: block;
                margin-bottom: 0.5rem;
                color: var(--text-color);
                font-size: 1rem;
                font-weight: 600;
                line-height: 1.4;
            }
            
            .booking-details-mini {
                display: flex;
                align-items: center;
                gap: 1.5rem;
                flex-wrap: wrap;
            }
            
            .booking-date {
                font-size: 0.9rem;
                color: var(--text-secondary);
                display: flex;
                align-items: center;
                gap: 0.5rem;
            }
            
            .booking-date::before {
                content: '📅';
                font-size: 0.9rem;
            }
            
            .booking-time {
                font-size: 0.9rem;
                color: var(--text-secondary);
                display: flex;
                align-items: center;
                gap: 0.5rem;
            }
            
            .booking-time::before {
                content: '🕒';
                font-size: 0.9rem;
            }
            
            .text-muted {
                color: var(--text-secondary) !important;
                font-style: italic;
                font-size: 0.9rem;
                margin-top: 0.5rem;
                text-align: center;
                padding: 0.75rem;
                background: #f8fafc;
                border-radius: 8px;
                border: 1px dashed var(--border-color);
            }
            
            /* Адаптивность */
            @media (max-width: 768px) {
                .user-modal {
                    max-width: 95% !important;
                    width: 95% !important;
                    margin: 10px auto !important;
                    max-height: 90vh !important;
                }
                
                .user-info-grid {
                    grid-template-columns: 1fr;
                    padding: 1rem;
                    gap: 1rem;
                }
                
                .info-item .label {
                    font-size: 0.8rem;
                }
                
                .info-item .value {
                    font-size: 0.95rem;
                }
                
                .booking-details-mini {
                    flex-direction: column;
                    align-items: flex-start;
                    gap: 0.5rem;
                }
            }
            
            @media (max-width: 480px) {
                .user-modal {
                    padding: 1rem !important;
                }
                
                .modal-header h3 {
                    font-size: 1.25rem;
                }
                
                .modal-footer {
                    flex-direction: column;
                    gap: 0.75rem;
                }
                
                .modal-footer .btn {
                    width: 100%;
                }
            }
        `;
        
        const styleElement = document.createElement('style');
        styleElement.id = 'user-modal-styles';
        styleElement.textContent = styles;
        document.head.appendChild(styleElement);
    }
    
    editUserRole(userId) {
        // Находим select для этого пользователя в списке
        const select = document.querySelector(`.role-select[data-user-id="${userId}"]`);
        if (select) {
            // Прокручиваем к элементу
            select.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            // Выделяем select
            select.focus();
            select.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.3)';
            
            // Убираем выделение через 2 секунды
            setTimeout(() => {
                select.style.boxShadow = '';
            }, 2000);
            
            // Закрываем модальное окно
            this.closeUserDetailsModal();
        } else {
            this.showNotification('Пользователь не найден в списке', 'error');
        }
    }
    updateDashboard() {
        console.log("📊 Обновление dashboard...");
        
        // Устанавливаем сегодняшнюю дату в фильтр по умолчанию
        const today = new Date().toISOString().split('T')[0];
        const dateInput = document.getElementById('filterDate');
        if (dateInput && !dateInput.value) {
            dateInput.value = today;
        }
        
        // Показываем все комнаты
        this.renderRoomsGrid();
    }
    
    renderRoomsGrid() {
        const container = document.getElementById('roomsGrid');
        if (!container) {
            console.error('❌ Элемент roomsGrid не найден');
            return;
        }
    
        console.log(`🏢 Отрисовка ${this.rooms.length} комнат`);
        container.innerHTML = '';
        
        if (this.rooms.length === 0) {
            container.innerHTML = '<p class="text-muted">Комнаты не найдены</p>';
            return;
        }
    
        const today = new Date().toISOString().split('T')[0];
        const bookings = this.bookings || [];
        
        this.rooms.forEach(room => {
            // Получаем бронирования для этой комнаты на сегодня
            const roomBookings = bookings.filter(b => 
                b && b.roomId === room.id && b.date === today
            );
    
            // Определяем статус комнаты
            const now = new Date();
            const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
            
            let isBusy = false;
            roomBookings.forEach(booking => {
                if (currentTime >= booking.startTime && currentTime < booking.endTime) {
                    isBusy = true;
                }
            });
    
            const roomElement = document.createElement('div');
            roomElement.className = 'room-card';
            roomElement.innerHTML = `
                <div class="room-header">
                    <h3 class="room-name">${room.name}</h3>
                    <span class="room-status ${isBusy ? 'status-busy' : 'status-free'}">
                        ${isBusy ? 'Занята' : 'Свободна'}
                    </span>
                </div>
                
                <div class="room-details">
                    <div class="detail-item">
                        <img src="/icons/people.png" alt="Вместимость" class="detail-icon">
                        <span>${room.capacity} чел.</span>
                    </div>
                    <div class="detail-item">
                        <img src="/icons/money.png" alt="Цена" class="detail-icon">
                        <span>${room.price} руб/час</span>
                    </div>
                    <div class="detail-item">
                        <img src="/icons/calendar.png" alt="Бронирования" class="detail-icon">
                        <span>${roomBookings.length} бронирований</span>
                    </div>
                </div>
                
                ${room.amenities ? `<p class="room-amenities"><small>${room.amenities}</small></p>` : ''}
                
                <div class="time-slots">
                    <strong style="display: block; margin-bottom: 0.5rem;">Слоты сегодня:</strong>
                    ${this.renderTimeSlots(roomBookings)}
                </div>
                
                <button class="btn btn-primary" onclick="window.app.bookRoom('${room.id}')" 
                        style="width: 100%; margin-top: 1rem;">
                    Забронировать
                </button>
            `;
    
            container.appendChild(roomElement);
        });
    }
    
    updateBookingForm() {
        console.log("📝 Обновление формы бронирования...");
        
        const roomSelect = document.getElementById('roomSelect');
        if (!roomSelect) {
            console.error('❌ Элемент roomSelect не найден');
            return;
        }
        
        // Очищаем и заполняем список комнат
        roomSelect.innerHTML = '<option value="">-- Выберите комнату --</option>';
        this.rooms.forEach(room => {
            const option = document.createElement('option');
            option.value = room.id;
            option.textContent = `${room.name} (${room.capacity} чел.)`;
            roomSelect.appendChild(option);
        });
        
        // Устанавливаем сегодняшнюю дату по умолчанию
        const today = new Date().toISOString().split('T')[0];
        const dateInput = document.getElementById('bookingDate');
        if (dateInput) {
            dateInput.value = today;
            dateInput.min = today;
        }
        
        // Заполняем времена
        this.fillTimeSelect('startTime');
        this.fillTimeSelect('endTime');
    }

    fillTimeSelect(selectId) {
        const select = document.getElementById(selectId);
        if (!select) {
            console.error(`❌ Элемент ${selectId} не найден`);
            return;
        }
        
        select.innerHTML = '<option value="">-- Выберите время --</option>';
        
        // Убедимся что timeSlots существует
        if (!this.timeSlots || this.timeSlots.length === 0) {
            console.log('🔄 Генерируем временные слоты...');
            this.timeSlots = this.generateTimeSlots();
        }
        
        // Проверяем что есть слоты
        if (!this.timeSlots || this.timeSlots.length === 0) {
            console.error('❌ Нет временных слотов для заполнения');
            return;
        }
        
        // Используем for...of вместо forEach
        for (const slot of this.timeSlots) {
            const option = document.createElement('option');
            option.value = slot.time;
            option.textContent = slot.display || slot.time;
            select.appendChild(option);
        }
    }
    
    async deleteRoom(roomId) {
        if (!confirm('Вы уверены, что хотите удалить эту комнату?')) {
            return;
        }

        try {
            const response = await fetch(`/api/rooms/${roomId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                this.showNotification('Комната удалена', 'success');
                await this.loadRoomsForAdmin();
            } else {
                const error = await response.json();
                this.showNotification(error.detail || 'Ошибка удаления комнаты', 'error');
            }
        } catch (error) {
            console.error('Error deleting room:', error);
            this.showNotification('Ошибка сети', 'error');
        }
    }
    
    bookRoom(roomId) {
        console.log(`📅 Бронирование комнаты: ${roomId}`);
        this.switchView('booking');
        
        // Устанавливаем выбранную комнату
        const roomSelect = document.getElementById('roomSelect');
        if (roomSelect) {
            const room = this.rooms.find(r => r.id === roomId);
            if (room) {
                roomSelect.value = roomId;
                this.updateTimeSlots();
            }
        }
    }

    async loadAuthUsers() {
        try {
            console.log("👥 Загрузка пользователей для авторизации...");
            const response = await fetch('/api/users/');
            if (response.ok) {
                this.users = await response.json();
                console.log(`✅ Загружено ${this.users.length} пользователей`);
                return this.users;
            } else {
                console.error('❌ Ошибка загрузки пользователей:', response.status);
                this.users = [];
                return [];
            }
        } catch (error) {
            console.error('❌ Ошибка сети при загрузке пользователей:', error);
            this.users = [];
            return [];
        }
    }
    
    async loadAccessList() {
        console.log("👥 Загрузка списка пользователей для управления доступом...");
        
        try {
            const response = await fetch('/api/users/');
            if (response.ok) {
                this.users = await response.json();
                console.log(`✅ Загружено ${this.users.length} пользователей`);
                
                // Ждем немного для гарантированного отображения DOM
                setTimeout(() => {
                    this.renderAccessList();
                }, 100);
                
            } else {
                const error = await response.json();
                this.showNotification(`Ошибка загрузки пользователей: ${error.detail}`, 'error');
            }
        } catch (error) {
            console.error('Error loading users:', error);
            this.showNotification('Ошибка сети при загрузке пользователей', 'error');
            
            // Показываем сообщение об ошибке в контейнере
            const container = document.getElementById('accessList');
            if (container) {
                container.innerHTML = `
                    <div class="no-data">
                        <p class="text-muted">Ошибка загрузки данных</p>
                        <button class="btn btn-secondary btn-small" onclick="window.app.loadAccessList()">
                            Повторить попытку
                        </button>
                    </div>
                `;
            }
        }
    }
    checkAccessElements() {
        console.log('🔍 Проверка элементов управления доступом:');
        
        const accessTab = document.getElementById('access-tab');
        if (!accessTab) {
            console.error('❌ Вкладка access-tab не найдена');
            return false;
        }
        
        let accessList = document.getElementById('accessList');
        if (!accessList) {
            console.log('⚠️ Элемент accessList не найден, создаем...');
            accessList = document.createElement('div');
            accessList.id = 'accessList';
            accessList.className = 'access-list';
            accessTab.appendChild(accessList);
            console.log('✅ Элемент accessList создан');
        }
        
        return true;
    }
    checkAdminElements() {
        console.log('🔍 Проверка элементов админ-панели...');
        
        const elements = [
            { id: 'roomsList', name: 'Список комнат' },
            { id: 'accessList', name: 'Список доступа' },
            { id: 'bookingsList', name: 'Список бронирований' },
            { id: 'rooms-tab', name: 'Вкладка комнат' },
            { id: 'access-tab', name: 'Вкладка доступа' },
            { id: 'bookings-tab', name: 'Вкладка бронирований' }
        ];
        
        elements.forEach(el => {
            const element = document.getElementById(el.id);
            if (element) {
                console.log(`✅ ${el.name} найден (${el.id})`);
            } else {
                console.error(`❌ ${el.name} не найден (${el.id})`);
            }
        });
    }

    renderAccessList() {
        const container = document.getElementById('accessList');
        if (!container) {
            console.error('❌ Элемент accessList не найден. Создаем временный...');
            const accessTab = document.getElementById('access-tab');
            if (accessTab) {
                const newContainer = document.createElement('div');
                newContainer.id = 'accessList';
                newContainer.className = 'access-list';
                accessTab.appendChild(newContainer);
                setTimeout(() => this.renderAccessList(), 50);
                return;
            }
            return;
        }
    
        console.log(`👥 Отрисовка ${this.users.length} пользователей для управления доступом`);
        container.innerHTML = '';
        
        if (!this.users || this.users.length === 0) {
            container.innerHTML = `
                <div class="no-data">
                    <p class="text-muted">Нет пользователей для отображения</p>
                    <button class="btn btn-secondary btn-small" onclick="window.app.loadAccessList()">
                        Обновить список
                    </button>
                </div>
            `;
            return;
        }
    
        // Создаем таблицу или список пользователей
        const usersList = document.createElement('div');
        usersList.className = 'users-grid';
        
        this.users.forEach(user => {
            const userCard = document.createElement('div');
            userCard.className = 'user-card';
            userCard.dataset.userId = user.id; // Сохраняем ID в dataset
            
            userCard.innerHTML = `
                <div class="user-card-header">
                    <h4>${user.name}</h4>
                    <span class="user-role-badge ${user.role}">${this.getRoleLabel(user.role)}</span>
                </div>
                <div class="user-card-body">
                    <p><strong>Email:</strong> ${user.email}</p>
                    <p><strong>ID:</strong> ${user.id}</p>
                    <p><strong>Зарегистрирован:</strong> ${new Date(user.createdAt).toLocaleDateString('ru-RU')}</p>
                </div>
                <div class="user-card-footer">
                    <select class="form-control role-select" data-user-id="${user.id}">
                        <option value="user" ${user.role === 'user' ? 'selected' : ''}>Пользователь</option>
                        <option value="manager" ${user.role === 'manager' ? 'selected' : ''}>Менеджер</option>
                        <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Администратор</option>
                    </select>
                    <button class="btn btn-secondary btn-small details-btn" data-user-id="${user.id}">
                        Подробнее
                    </button>
                </div>
            `;
            usersList.appendChild(userCard);
        });
        
        container.appendChild(usersList);
        
        // Привязываем обработчики событий ПОСЛЕ добавления в DOM
        this.bindUserCardEvents();
    }
    bindUserCardEvents() {
        console.log("🔗 Привязка обработчиков для карточек пользователей...");
        
        // Обработчики для кнопок "Подробнее"
        document.querySelectorAll('.details-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                const userId = btn.dataset.userId;
                console.log(`🔍 Просмотр деталей пользователя: ${userId}`);
                
                if (userId) {
                    this.viewUserDetails(userId);
                } else {
                    console.error('❌ User ID не найден в dataset');
                }
            });
        });
        
        // Обработчики для выбора ролей
        document.querySelectorAll('.role-select').forEach(select => {
            select.addEventListener('change', (e) => {
                const userId = select.dataset.userId;
                const newRole = select.value;
                
                console.log(`🔄 Изменение роли пользователя ${userId} на ${newRole}`);
                
                if (userId && newRole) {
                    this.updateUserRole(userId, newRole);
                } else {
                    console.error('❌ User ID или роль не найдены');
                }
            });
        });
    }

    async updateUserRole(userId, role) {
        console.log(`🔄 Обновление роли пользователя ${userId} на ${role}`);
        
        try {
            const response = await fetch(`/api/users/${userId}/role`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ role: role })
            });

            if (response.ok) {
                const user = await response.json();
                this.showNotification(`Роль пользователя ${user.name} обновлена на ${this.getRoleLabel(role)}`, 'success');
                
                // Обновляем список
                await this.loadAccessList();
            } else {
                const error = await response.json();
                this.showNotification(error.detail || 'Ошибка обновления роли', 'error');
            }
        } catch (error) {
            console.error('Error updating role:', error);
            this.showNotification('Ошибка сети', 'error');
        }
    }

    async loadAllBookings() {
        console.log("📅 Загрузка всех бронирований...");
        try {
            const response = await fetch('/api/bookings/');
            if (response.ok) {
                this.bookings = await response.json();
                this.renderAllBookings();
            } else {
                console.error('❌ Ошибка загрузки бронирований:', response.status);
                // Используем пустой массив вместо ошибки
                this.bookings = [];
                this.renderAllBookings();
            }
        } catch (error) {
            console.error('❌ Ошибка сети при загрузке бронирований:', error);
            this.bookings = [];
            this.renderAllBookings();
        }
    }

    renderAllBookings() {
        const container = document.getElementById('bookingsList');
        if (!container) {
            console.error('❌ Элемент bookingsList не найден');
            return;
        }
    
        console.log(`📅 Отрисовка ${this.bookings.length} бронирований`);
        container.innerHTML = '';
        
        if (this.bookings.length === 0) {
            container.innerHTML = '<p class="text-muted">Нет бронирований</p>';
            return;
        }
    
        this.bookings.forEach(booking => {
            // Находим комнату
            const room = this.rooms.find(r => r.id === booking.roomId);
            const roomName = room ? room.name : 'Неизвестная комната';
            
            // Находим пользователя
            const user = this.users.find(u => u.id === booking.userId);
            const userName = user ? user.name : 'Неизвестный пользователь';
            
            // Проверяем, может ли текущий пользователь отменять бронирование
            const canCancel = this.isAdminOrManager() || 
                             (this.currentUser && this.currentUser.id === booking.userId);
            
            const bookingElement = document.createElement('div');
            bookingElement.className = 'list-item';
            bookingElement.innerHTML = `
                <div class="item-info">
                    <h4>${booking.title}</h4>
                    <p>${roomName} • ${userName}</p>
                    <p>
                        <small>
                            📅 ${booking.date} • 
                            ⏰ ${booking.startTime}-${booking.endTime}
                        </small>
                    </p>
                    ${booking.participants && booking.participants.length > 0 ? 
                        `<p><small>👥 Участники: ${booking.participants.join(', ')}</small></p>` : ''}
                </div>
                <div class="item-actions">
                    ${canCancel ? `
                        <button class="btn btn-danger btn-small" onclick="window.app.deleteBooking('${booking.id}')">
                            Отменить
                        </button>
                    ` : ''}
                </div>
            `;
            container.appendChild(bookingElement);
        });
    }

    async loadManagerStats() {
        try {
            const response = await fetch('/api/bookings/');
            if (response.ok) {
                const allBookings = await response.json();
                const today = new Date().toISOString().split('T')[0];
                
                // Статистика на сегодня
                const todayBookings = allBookings.filter(b => b.date === today);
                
                // Статистика по комнатам
                const roomStats = {};
                allBookings.forEach(booking => {
                    roomStats[booking.roomId] = (roomStats[booking.roomId] || 0) + 1;
                });
                
                return {
                    totalBookings: allBookings.length,
                    todayBookings: todayBookings.length,
                    mostBookedRoom: this.getMostBookedRoom(roomStats),
                    upcomingBookings: allBookings.filter(b => b.date >= today).length
                };
            }
        } catch (error) {
            console.error('Error loading stats:', error);
        }
        return null;
    }
    
    getMostBookedRoom(roomStats) {
        let maxBookings = 0;
        let mostBookedRoomId = null;
        
        for (const [roomId, count] of Object.entries(roomStats)) {
            if (count > maxBookings) {
                maxBookings = count;
                mostBookedRoomId = roomId;
            }
        }
        
        if (mostBookedRoomId) {
            const room = this.rooms.find(r => r.id === mostBookedRoomId);
            return room ? room.name : 'Неизвестная комната';
        }
        return 'Нет данных';
    }
    async deleteBooking(bookingId) {
        if (!this.currentUser) {
            this.showNotification('Необходимо войти в систему', 'error');
            return;
        }
        
        try {
            // Получаем информацию о бронировании
            const response = await fetch(`/api/bookings/${bookingId}`);
            if (!response.ok) {
                this.showNotification('Бронирование не найдено', 'error');
                return;
            }
            
            const booking = await response.json();
            
            // Проверяем права на отмену
            const canCancel = this.isAdmin() || 
                             this.isManager() || 
                             (this.currentUser.id === booking.userId);
            
            if (!canCancel) {
                this.showNotification('У вас нет прав для отмены этого бронирования', 'error');
                return;
            }
            
            if (!confirm('Вы уверены, что хотите отменить это бронирование?')) {
                return;
            }
        
            const deleteResponse = await fetch(`/api/bookings/${bookingId}`, {
                method: 'DELETE'
            });
        
            if (deleteResponse.ok) {
                this.showNotification('Бронирование отменено', 'success');
                await this.loadAllBookings();
            } else {
                const error = await deleteResponse.json();
                this.showNotification(error.detail || 'Ошибка отмены бронирования', 'error');
            }
        } catch (error) {
            console.error('Error deleting booking:', error);
            this.showNotification('Ошибка сети', 'error');
        }
    }
    async registerUser() {
        console.log("👤 Регистрация нового пользователя...");
        
        // Получаем данные из формы
        const firstName = document.getElementById('registerFirstName').value.trim();
        const lastName = document.getElementById('registerLastName').value.trim();
        const email = document.getElementById('registerEmail').value.trim();
        const password = document.getElementById('registerPassword').value.trim();
        const validationErrors = [];
        // Валидация
        if (!firstName || !lastName || !email || !password) {
            this.showNotification('Заполните все поля', 'error');
            return;
        }
    
        if (!email.includes('@') || !email.includes('.')) {
            this.showNotification('Введите корректный email', 'error');
            document.getElementById('registerEmail').focus();
            return;
        }
    
        if (password.length < 4) {
            this.showNotification('Пароль должен содержать минимум 4 символа', 'error');
            document.getElementById('registerPassword').focus();
            return;
        }
        if (!firstName || firstName.length < 2) {
            validationErrors.push('Имя должно содержать минимум 2 символа');
            document.getElementById('registerFirstName').classList.add('input-error');
        } else if (firstName.length > 50) {
            validationErrors.push('Имя не должно превышать 50 символов');
            document.getElementById('registerFirstName').classList.add('input-error');
        } else if (!/^[a-zA-Zа-яА-ЯёЁ\s\-]+$/.test(firstName)) {
            validationErrors.push('Имя может содержать только буквы, пробелы и дефисы');
            document.getElementById('registerFirstName').classList.add('input-error');
        } else {
            document.getElementById('registerFirstName').classList.remove('input-error');
        }
        
        // Проверка фамилии
        if (!lastName || lastName.length < 2) {
            validationErrors.push('Фамилия должна содержать минимум 2 символа');
            document.getElementById('registerLastName').classList.add('input-error');
        } else if (lastName.length > 50) {
            validationErrors.push('Фамилия не должна превышать 50 символов');
            document.getElementById('registerLastName').classList.add('input-error');
        } else if (!/^[a-zA-Zа-яА-ЯёЁ\s\-]+$/.test(lastName)) {
            validationErrors.push('Фамилия может содержать только буквы, пробелы и дефисы');
            document.getElementById('registerLastName').classList.add('input-error');
        } else {
            document.getElementById('registerLastName').classList.remove('input-error');
        }
        
        // Проверка email
        if (!email) {
            validationErrors.push('Email обязателен для заполнения');
            document.getElementById('registerEmail').classList.add('input-error');
        } else if (email.length > 100) {
            validationErrors.push('Email не должен превышать 100 символов');
            document.getElementById('registerEmail').classList.add('input-error');
        } else if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)) {
            validationErrors.push('Введите корректный email адрес (например: user@example.com)');
            document.getElementById('registerEmail').classList.add('input-error');
        } else {
            document.getElementById('registerEmail').classList.remove('input-error');
        }
        
        // Проверка пароля
        if (!password || password.length < 4) {
            validationErrors.push('Пароль должен содержать минимум 4 символа');
            document.getElementById('registerPassword').classList.add('input-error');
        } else if (password.length > 100) {
            validationErrors.push('Пароль не должен превышать 100 символов');
            document.getElementById('registerPassword').classList.add('input-error');
        } else {
            document.getElementById('registerPassword').classList.remove('input-error');
        }
        try {
            // Отправляем запрос на регистрацию
            const response = await fetch('/api/users/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    firstName: firstName,
                    lastName: lastName,
                    email: email,
                    password: password
                })
            });
    
            if (response.ok) {
                const user = await response.json();
                console.log('✅ Пользователь зарегистрирован:', user);
                
                // Устанавливаем текущего пользователя
                this.currentUser = user;
                localStorage.setItem('soveshaika_user', JSON.stringify(user));
                
                // Очищаем форму
                document.getElementById('registerFirstName').value = '';
                document.getElementById('registerLastName').value = '';
                document.getElementById('registerEmail').value = '';
                document.getElementById('registerPassword').value = '';
                
                // Обновляем UI
                this.updateUserDisplay();
                
                // Загружаем данные
                await this.loadRooms();
                
                // Переключаемся на главную страницу
                this.switchView('home');
                
                // Показываем уведомление
                this.showNotification(`Добро пожаловать, ${firstName}!`, 'success');
                
            } else {
                const error = await response.json();
                console.error('❌ Ошибка регистрации:', error);
                this.showNotification(error.detail || 'Ошибка регистрации', 'error');
            }
            
        } catch (error) {
            console.error('❌ Ошибка сети при регистрации:', error);
            this.showNotification('Ошибка сети', 'error');
        }
    }
    // Методы валидации в реальном времени
validateName(input, fieldName) {
    const value = input.value.trim();
    const hint = input.nextElementSibling;
    
    if (!value) {
        input.classList.remove('input-error');
        if (hint) hint.className = 'form-hint';
        return false;
    }
    
    if (value.length < 2) {
        input.classList.add('input-error');
        if (hint) {
            hint.className = 'form-hint invalid';
            hint.textContent = `${fieldName} должно содержать минимум 2 символа`;
        }
        return false;
    }
    
    if (value.length > 50) {
        input.classList.add('input-error');
        if (hint) {
            hint.className = 'form-hint invalid';
            hint.textContent = `${fieldName} не должно превышать 50 символов`;
        }
        return false;
    }
    
    if (!/^[a-zA-Zа-яА-ЯёЁ\s\-]+$/.test(value)) {
        input.classList.add('input-error');
        if (hint) {
            hint.className = 'form-hint invalid';
            hint.textContent = `${fieldName} может содержать только буквы, пробелы и дефисы`;
        }
        return false;
    }
    
    input.classList.remove('input-error');
    if (hint) {
        hint.className = 'form-hint valid';
        hint.textContent = `${fieldName} корректно`;
    }
    return true;
}

validateEmail(input) {
    const value = input.value.trim().toLowerCase();
    const hint = input.nextElementSibling;
    
    if (!value) {
        input.classList.remove('input-error');
        if (hint) hint.className = 'form-hint';
        return false;
    }
    
    if (value.length > 100) {
        input.classList.add('input-error');
        if (hint) {
            hint.className = 'form-hint invalid';
            hint.textContent = 'Email не должен превышать 100 символов';
        }
        return false;
    }
    
    if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(value)) {
        input.classList.add('input-error');
        if (hint) {
            hint.className = 'form-hint invalid';
            hint.textContent = 'Введите корректный email адрес (например: user@example.com)';
        }
        return false;
    }
    
    input.classList.remove('input-error');
    if (hint) {
        hint.className = 'form-hint valid';
        hint.textContent = 'Email корректный';
    }
    return true;
}

validatePassword(input) {
    const value = input.value.trim();
    const hint = input.nextElementSibling;
    
    if (!value) {
        input.classList.remove('input-error');
        if (hint) hint.className = 'form-hint';
        return false;
    }
    
    if (value.length < 4) {
        input.classList.add('input-error');
        if (hint) {
            hint.className = 'form-hint invalid';
            hint.textContent = 'Пароль должен содержать минимум 4 символа';
        }
        return false;
    }
    
    if (value.length > 100) {
        input.classList.add('input-error');
        if (hint) {
            hint.className = 'form-hint invalid';
            hint.textContent = 'Пароль не должен превышать 100 символов';
        }
        return false;
    }
    
    input.classList.remove('input-error');
    if (hint) {
        hint.className = 'form-hint valid';
        hint.textContent = 'Пароль корректный';
    }
    return true;
}
bindEvents() {
    console.log("🔗 Привязка обработчиков событий...");
    
    // 1. Навигационные кнопки
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const view = e.target.dataset.view;
            this.switchView(view);
        });
    });

    // 2. Кнопка выхода
    const logoutBtn = document.querySelector('.logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            console.log("🖱️ Кнопка выхода нажата");
            this.logout();
        });
    }

    // 3. Клик по имени пользователя
    const userName = document.querySelector('.user-name');
    if (userName) {
        userName.addEventListener('click', () => {
            this.switchView('profile');
        });
    }

    // 4. Кнопка "Применить фильтры"
    const applyFiltersBtn = document.getElementById('applyFilters');
    if (applyFiltersBtn) {
        applyFiltersBtn.addEventListener('click', () => {
            this.applyFilters();
        });
    }
    
    // 5. Кнопка "Сбросить фильтры"
    const resetFiltersBtn = document.getElementById('resetFilters');
    if (resetFiltersBtn) {
        resetFiltersBtn.addEventListener('click', () => {
            this.resetFilters();
        });
    }
    
    // 6. Кнопка "Забронировать" в форме бронирования
    const confirmBookingBtn = document.getElementById('confirmBookingBtn');
    if (confirmBookingBtn) {
        confirmBookingBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log("🖱️ Кнопка 'Забронировать' нажата");
            this.confirmBooking();
        });
    }
    
    // 7. Админка - вкладки
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tab = e.target.dataset.tab;
            this.switchTab(tab);
        });
    });
    
    // 8. Админка - кнопка добавления комнаты
    const addRoomBtn = document.getElementById('addRoomBtn');
    if (addRoomBtn) {
        console.log("✅ Найдена кнопка добавления комнаты");
        // Удаляем старые обработчики
        addRoomBtn.replaceWith(addRoomBtn.cloneNode(true));
        
        // Находим обновленную кнопку
        const newAddRoomBtn = document.getElementById('addRoomBtn');
        newAddRoomBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log("🖱️ Кнопка 'Добавить комнату' нажата");
            this.addRoom();
        });
    } else {
        console.error("❌ Кнопка добавления комнаты не найдена!");
    }
    
    // 9. Обновление времени при выборе даты
    const bookingDate = document.getElementById('bookingDate');
    if (bookingDate) {
        bookingDate.addEventListener('change', () => {
            this.updateTimeSlots();
        });
    }
    
    // 10. Обновление времени при выборе комнаты
    const roomSelect = document.getElementById('roomSelect');
    if (roomSelect) {
        roomSelect.addEventListener('change', () => {
            this.updateTimeSlots();
        });
    }
    
    // 11. Фильтры - переключение панели
    const filterToggle = document.getElementById('filterToggle');
    if (filterToggle) {
        filterToggle.addEventListener('click', () => {
            const panel = document.getElementById('filterPanel');
            panel.classList.toggle('active');
        });
    }
    
    // 12. Кнопки входа/регистрации (если остались)
    const loginBtn = document.querySelector('[onclick*="passwordLogin"]');
    if (loginBtn) {
        console.log("🔧 Найдена кнопка входа");
        loginBtn.removeAttribute('onclick');
        loginBtn.addEventListener('click', (e) => {
            e.preventDefault();
            console.log("🖱️ Кнопка 'Войти' нажата");
            this.passwordLogin();
        });
    }
    const switchToRegisterBtn = document.querySelector('[onclick*="switchAuthMode(\'register\')"]');
    if (switchToRegisterBtn) {
        console.log("🔧 Найдена кнопка переключения на регистрацию");
        switchToRegisterBtn.removeAttribute('onclick');
        switchToRegisterBtn.addEventListener('click', (e) => {
            e.preventDefault();
            this.switchAuthMode('register');
        });
    }
    const switchToLoginBtn = document.querySelector('[onclick*="switchAuthMode(\'login\')"]');
    if (switchToLoginBtn) {
        console.log("🔧 Найдена кнопка переключения на вход");
        switchToLoginBtn.removeAttribute('onclick');
        switchToLoginBtn.addEventListener('click', (e) => {
            e.preventDefault();
            this.switchAuthMode('login');
        });
    }
    const roomPrice = document.getElementById('roomPrice');
    if (roomPrice) {
        roomPrice.addEventListener('input', (e) => {
            let value = e.target.value;
            
            // Убираем все кроме цифр
            value = value.replace(/[^\d]/g, '');
            
            // Ограничиваем максимальное значение
            if (parseInt(value) > 100000) {
                value = '100000';
            }
            
            e.target.value = value;
        });
    }
    const registerBtn = document.querySelector('[onclick*="registerUser"]');
    if (registerBtn) {
        console.log("🔧 Найдена кнопка регистрации через onclick");
        
        // Удаляем атрибут onclick чтобы избежать дублирования
        registerBtn.removeAttribute('onclick');
        
        // Добавляем обработчик через addEventListener
        registerBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log("🖱️ Кнопка 'Зарегистрироваться' нажата");
            this.registerUser();
        });
    }
    
    console.log("✅ Все обработчики событий привязаны");
}
    
    applyFilters() {
        console.log("🔍 Применение фильтров...");
        this.filterRooms();
    }
    
    resetFilters() {
        console.log("🔄 Сброс фильтров...");
        
        // Сбрасываем все чекбоксы
        document.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            checkbox.checked = true;
        });
        
        // Сбрасываем дату на сегодня
        const today = new Date().toISOString().split('T')[0];
        const dateInput = document.getElementById('filterDate');
        if (dateInput) {
            dateInput.value = today;
        }
        
        // Сбрасываем поле оборудования
        document.getElementById('filterAmenities').value = '';
        
        // Показываем все комнаты снова
        this.updateDashboard();
        
        this.showNotification('Фильтры сброшены', 'info');
    }
    
    async filterRooms() {
        console.log("🔍 Применение фильтров...");
        
        try {
            // 1. Получаем значения фильтров
            const statusFilters = Array.from(
                document.querySelectorAll('input[name="status"]:checked')
            ).map(cb => cb.value);
            
            const capacityFilters = Array.from(
                document.querySelectorAll('input[name="capacity"]:checked')
            ).map(cb => cb.value);
            
            const filterDate = document.getElementById('filterDate').value;
            const filterAmenities = document.getElementById('filterAmenities').value.toLowerCase();
            
            console.log("📊 Параметры фильтрации:", {
                statusFilters,
                capacityFilters,
                filterDate,
                filterAmenities
            });
            
            // 2. Загружаем актуальные данные (если еще не загружены)
            if (this.rooms.length === 0) {
                console.log("🔄 Загрузка комнат для фильтрации...");
                await this.loadRooms();
            }
            
            // 3. Загружаем бронирования для проверки занятости
            let allBookings = [];
            try {
                const response = await fetch('/api/bookings/');
                if (response.ok) {
                    allBookings = await response.json();
                }
            } catch (error) {
                console.error("❌ Ошибка загрузки бронирований:", error);
            }
            
            // 4. Фильтруем комнаты
            const today = new Date().toISOString().split('T')[0];
            const checkDate = filterDate || today;
            
            const filteredRooms = this.rooms.filter(room => {
                let includeRoom = true;
                
                // Фильтр по оборудованию
                if (filterAmenities && includeRoom) {
                    const roomAmenities = (room.amenities || '').toLowerCase();
                    if (!roomAmenities.includes(filterAmenities)) {
                        includeRoom = false;
                    }
                }
                
                // Фильтр по вместимости
                if (capacityFilters.length > 0 && includeRoom) {
                    let capacityMatch = false;
                    
                    if (room.capacity <= 2 && capacityFilters.includes('1-2')) {
                        capacityMatch = true;
                    }
                    if (room.capacity >= 3 && room.capacity <= 5 && capacityFilters.includes('3-5')) {
                        capacityMatch = true;
                    }
                    if (room.capacity >= 6 && room.capacity <= 10 && capacityFilters.includes('6-10')) {
                        capacityMatch = true;
                    }
                    if (room.capacity > 10 && capacityFilters.includes('10+')) {
                        capacityMatch = true;
                    }
                    
                    if (!capacityMatch) {
                        includeRoom = false;
                    }
                }
                
                // Фильтр по статусу (занята/свободна)
                if (statusFilters.length > 0 && includeRoom) {
                    const roomBookings = allBookings.filter(b => 
                        b.roomId === room.id && b.date === checkDate
                    );
                    
                    const isBusy = roomBookings.length > 0;
                    const isFree = roomBookings.length === 0;
                    
                    let statusMatch = false;
                    if (isBusy && statusFilters.includes('busy')) {
                        statusMatch = true;
                    }
                    if (isFree && statusFilters.includes('free')) {
                        statusMatch = true;
                    }
                    
                    if (!statusMatch) {
                        includeRoom = false;
                    }
                }
                
                return includeRoom;
            });
            
            console.log(`✅ Отфильтровано: ${filteredRooms.length} из ${this.rooms.length} комнат`);
            
            // 5. Отображаем результат
            this.renderFilteredRooms(filteredRooms, checkDate, allBookings);
            
            // 6. Закрываем панель фильтров
            document.getElementById('filterPanel').classList.remove('active');
            
            this.showNotification(
                `Найдено ${filteredRooms.length} комнат`, 
                filteredRooms.length > 0 ? 'success' : 'info'
            );
            
        } catch (error) {
            console.error("❌ Ошибка фильтрации:", error);
            this.showNotification('Ошибка фильтрации', 'error');
        }
    }
    bindModalEvents() {
        // Закрытие по клику вне модального окна
        document.addEventListener('click', (e) => {
            const modalContainer = document.getElementById('userDetailsModalContainer');
            if (modalContainer) {
                const modalOverlay = modalContainer.querySelector('.modal-overlay');
                const modalContent = modalContainer.querySelector('.modal-content');
                
                if (modalOverlay && modalContent && 
                    e.target === modalOverlay && 
                    !modalContent.contains(e.target)) {
                    this.closeUserDetailsModal();
                }
            }
        });
        
        // Закрытие по клавише Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const modalContainer = document.getElementById('userDetailsModalContainer');
                if (modalContainer) {
                    this.closeUserDetailsModal();
                }
            }
        });
    }
    renderFilteredRooms(rooms, date, bookings) {
        const container = document.getElementById('roomsGrid');
        if (!container) {
            console.error('❌ Элемент roomsGrid не найден');
            return;
        }
    
        console.log(`🏢 Отрисовка ${rooms.length} комнат после фильтрации`);
        container.innerHTML = '';
        
        if (rooms.length === 0) {
            container.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 3rem;">
                    <h3 style="color: var(--text-secondary); margin-bottom: 1rem;">😕 Комнаты не найдены</h3>
                    <p style="color: var(--text-secondary);">Попробуйте изменить параметры фильтров</p>
                    <button class="btn btn-primary" onclick="window.app.resetFilters()" style="margin-top: 1rem;">
                        Сбросить фильтры
                    </button>
                </div>
            `;
            return;
        }
    
        rooms.forEach(room => {
            // Получаем бронирования для этой комнаты на выбранную дату
            const roomBookings = bookings.filter(b => 
                b && b.roomId === room.id && b.date === date
            );
    
            // Определяем статус комнаты
            const now = new Date();
            const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
            
            let isBusy = false;
            roomBookings.forEach(booking => {
                if (currentTime >= booking.startTime && currentTime < booking.endTime) {
                    isBusy = true;
                }
            });
    
            const roomElement = document.createElement('div');
            roomElement.className = 'room-card';
            roomElement.innerHTML = `
                <div class="room-header">
                    <h3 class="room-name">${room.name}</h3>
                    <span class="room-status ${isBusy ? 'status-busy' : 'status-free'}">
                        ${isBusy ? 'Занята' : 'Свободна'}
                    </span>
                </div>
                
                <div class="room-details">
                    <div class="detail-item">
                        <img src="/icons/people.png" alt="Вместимость" class="detail-icon">
                        <span>${room.capacity} чел.</span>
                    </div>
                    <div class="detail-item">
                        <img src="/icons/money.png" alt="Цена" class="detail-icon">
                        <span>${room.price} руб/час</span>
                    </div>
                    <div class="detail-item">
                        <img src="/icons/calendar.png" alt="Бронирования" class="detail-icon">
                        <span>${roomBookings.length} бронирований</span>
                    </div>
                </div>
                
                ${room.amenities ? `<p class="room-amenities"><small>${room.amenities}</small></p>` : ''}
                
                <div class="time-slots">
                    <strong style="display: block; margin-bottom: 0.5rem;">Слоты на ${date}:</strong>
                    ${this.renderTimeSlots(roomBookings)}
                </div>
                
                <button class="btn btn-primary" onclick="window.app.bookRoom('${room.id}')" 
                        style="width: 100%; margin-top: 1rem;">
                    Забронировать
                </button>
            `;
    
            container.appendChild(roomElement);
        });
    }
    async confirmBooking() {
        console.log("✅ Подтверждение бронирования...");
        
        if (!this.currentUser) {
            this.showNotification('Необходимо войти в систему', 'error');
            this.switchView('auth');
            return;
        }
    
        const roomId = document.getElementById('roomSelect').value;
        const date = document.getElementById('bookingDate').value;
        const startTime = document.getElementById('startTime').value;
        const endTime = document.getElementById('endTime').value;
        const title = document.getElementById('meetingTitle').value;
        const participants = document.getElementById('participants').value;
    
        if (!roomId || !date || !startTime || !endTime || !title) {
            this.showNotification('Заполните все обязательные поля', 'error');
            return;
        }
    
        if (startTime >= endTime) {
            this.showNotification('Время окончания должно быть позже времени начала', 'error');
            return;
        }
    
        try {
            const response = await fetch('/api/bookings/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    roomId: roomId,
                    userId: this.currentUser.id,
                    date: date,
                    startTime: startTime,
                    endTime: endTime,
                    title: title,
                    participants: participants ? participants.split(',').map(p => p.trim()) : []
                })
            });
    
            if (response.ok) {
                const booking = await response.json();
                const roomName = this.rooms.find(r => r.id === roomId)?.name || 'Переговорная';
                this.showNotification(`"${roomName}" успешно забронирована на ${date} с ${startTime} до ${endTime}`, 'success');
    
                // Очищаем форму
                document.getElementById('meetingTitle').value = '';
                document.getElementById('participants').value = '';
                
                // Переключаемся на расписание
                this.switchView('dashboard');
            } else {
                const error = await response.json();
                this.showNotification(error.detail || 'Ошибка бронирования', 'error');
            }
        } catch (error) {
            console.error('❌ Ошибка сети при бронировании:', error);
            this.showNotification('Ошибка сети', 'error');
        }
    }   
    async updateTimeSlots() {
        const roomId = document.getElementById('roomSelect')?.value;
        const date = document.getElementById('bookingDate')?.value;
        
        if (!roomId || !date) {
            this.clearTimeSlots();
            return;
        }
        
        try {
            // Загружаем бронирования для выбранной комнаты и даты
            const response = await fetch(`/api/bookings/?room_id=${roomId}&booking_date=${date}`);
            if (response.ok) {
                const bookings = await response.json();
                this.renderAvailableTimeSlots(bookings);
            } else {
                console.error('❌ Ошибка загрузки временных слотов:', response.status);
                this.showNotification('Не удалось загрузить доступные слоты', 'error');
                this.clearTimeSlots();
            }
        } catch (error) {
            console.error('❌ Ошибка сети при загрузке слотов:', error);
            this.showNotification('Ошибка сети', 'error');
            this.clearTimeSlots();
        }
    }

    clearTimeSlots() {
        const container = document.getElementById('availabilityGrid');
        if (container) {
            container.innerHTML = '';
        }
    }

    renderAvailableTimeSlots(bookings) {
        const container = document.getElementById('availabilityGrid');
        if (!container) return;
        
        container.innerHTML = '<h3>Доступные слоты:</h3>';
        
        if (!bookings || bookings.length === 0) {
            container.innerHTML += '<p class="text-muted">Свободно весь день</p>';
            return;
        }
        
        const bookedSlots = new Set();
        bookings.forEach(booking => {
            // Добавляем все слоты между началом и концом бронирования
            const start = this.timeToMinutes(booking.startTime);
            const end = this.timeToMinutes(booking.endTime);
            
            for (let time = start; time < end; time += 30) {
                const timeStr = this.minutesToTime(time);
                bookedSlots.add(timeStr);
            }
        });
        
        const availableSlots = this.timeSlots.filter(slot => !bookedSlots.has(slot.time));
        
        if (availableSlots.length === 0) {
            container.innerHTML += '<p class="text-muted">Нет доступных слотов на выбранную дату</p>';
            return;
        }
        
        const slotsGrid = document.createElement('div');
        slotsGrid.className = 'slots-grid';
        slotsGrid.style.display = 'grid';
        slotsGrid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(120px, 1fr))';
        slotsGrid.style.gap = '0.5rem';
        slotsGrid.style.marginTop = '1rem';
        
        availableSlots.forEach(slot => {
            const slotBtn = document.createElement('button');
            slotBtn.className = 'btn btn-secondary';
            slotBtn.textContent = slot.display;
            slotBtn.style.fontSize = '0.875rem';
            slotBtn.style.padding = '0.5rem';
            slotBtn.addEventListener('click', () => {
                this.selectTimeSlot(slot.time);
            });
            slotsGrid.appendChild(slotBtn);
        });
        
        container.appendChild(slotsGrid);
    }

    timeToMinutes(time) {
        if (!time) return 0;
        const [hours, minutes] = time.split(':').map(Number);
        return hours * 60 + minutes;
    }

    minutesToTime(minutes) {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
    }

    selectTimeSlot(time) {
        const startSelect = document.getElementById('startTime');
        const endSelect = document.getElementById('endTime');
        
        if (startSelect) {
            startSelect.value = time;
        }
        
        if (endSelect) {
            // Автоматически выбираем следующий слот как время окончания
            const nextTime = this.getNextTimeSlot(time);
            endSelect.value = nextTime;
        }
    }

    getNextTimeSlot(time) {
        const minutes = this.timeToMinutes(time);
        const nextMinutes = minutes + 30;
        return this.minutesToTime(nextMinutes);
    }

    renderTimeSlots(bookings) {
        if (!bookings || bookings.length === 0) {
            return '<span class="slot available">Свободно весь день</span>';
        }
        
        // Сортируем бронирования по времени
        const sortedBookings = [...bookings].sort((a, b) => 
            a.startTime.localeCompare(b.startTime)
        );
        
        // Генерируем временные слоты с 9:00 до 18:00
        const timeSlots = [];
        for (let hour = 9; hour <= 18; hour++) {
            for (let minute of ['00', '30']) {
                const time = `${hour.toString().padStart(2, '0')}:${minute}`;
                const display = `${hour}:${minute}`;
                
                // Проверяем, занят ли этот слот
                const isBooked = sortedBookings.some(booking => 
                    time >= booking.startTime && time < booking.endTime
                );
                
                const slotClass = isBooked ? 'slot booked' : 'slot available';
                const slotText = isBooked ? 'Занято' : display;
                
                timeSlots.push(`<span class="${slotClass}">${slotText}</span>`);
            }
        }
        
        return timeSlots.join('');
    }

    getRoleLabel(role) {
        const labels = {
            'user': 'Пользователь',
            'manager': 'Менеджер',
            'admin': 'Администратор'
        };
        return labels[role] || role;
    }

    async loginUser(email, password) {
        try {
            const response = await fetch('/api/users/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            if (response.ok) {
                const user = await response.json();
                this.currentUser = user;
                localStorage.setItem('soveshaika_user', JSON.stringify(user));
                this.updateUserDisplay();
                await this.loadRooms();
                this.switchView('home');
                showNotification(`Вход выполнен как ${user.name}`, 'success');
            } else {
                const error = await response.json();
                showNotification(error.detail || 'Ошибка входа', 'error');
            }
        } catch (error) {
            showNotification('Ошибка сети при входе', 'error');
        }
    }

    async switchUser(userId) {
        console.log(`👤 Переключение на пользователя: ${userId}`);
        
        // Находим пользователя
        const user = this.users.find(u => u.id === userId);
        if (!user) {
            this.showNotification('Пользователь не найден', 'error');
            return;
        }
        
        try {
            // Пробуем стандартный пароль
            const response = await fetch('/api/users/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    email: user.email, 
                    password: 'password123' // Стандартный пароль
                })
            });
            
            if (response.ok) {
                const userData = await response.json();
                this.currentUser = userData;
                localStorage.setItem('soveshaika_user', JSON.stringify(userData));
                this.updateUI();
                this.showNotification(`Вы вошли как ${userData.name}`, 'success');
                
                // Обновляем профиль
                this.updateProfile();
                
                // Возвращаемся на главную
                this.switchView('home');
            } else {
                // Если стандартный пароль не подошел, пробуем вход через форму
                this.showNotification('Используйте форму входа', 'info');
                this.switchView('auth');
            }
        } catch (error) {
            console.error('Ошибка переключения пользователя:', error);
            this.showNotification('Ошибка сети', 'error');
        }
    }

    switchView(viewName) {
        console.log(`🔄 Переключение на вид: ${viewName}`);
        
        // Скрыть все views
        document.querySelectorAll('.view').forEach(view => {
            view.classList.remove('active');
        });
    
        // Показать выбранный view
        const viewElement = document.getElementById(viewName);
        if (viewElement) {
            viewElement.classList.add('active');
        }
    
        // Обновить активную кнопку навигации
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.view === viewName) {
                btn.classList.add('active');
            }
        });
    
        // Загрузить данные для view
        switch (viewName) {
            case 'dashboard':
                this.updateDashboard();
                break;
            case 'booking':
                this.updateBookingForm();
                break;
            case 'profile':
                this.updateProfile();
                break;
                case 'admin':
                    if (this.isAdminOrManager()) {
                        this.updateAdminPanel();
                    } else {
                        this.showNotification('Доступ запрещен', 'error');
                        this.switchView('home');
                    }
                    break;
        }
    }
    
    updateAdminPanel() {
        console.log("🛠 Инициализация панели управления");
        
        // Проверяем элементы DOM
        this.checkAdminElements();
        
        // Показываем/скрываем вкладки в зависимости от роли
        this.updateAdminTabsVisibility();
        
        // Ждем немного перед загрузкой данных
        setTimeout(() => {
            // Загружаем данные для активной вкладки
            const activeTab = document.querySelector('.tab-btn.active');
            if (activeTab) {
                const tabName = activeTab.dataset.tab;
                
                switch(tabName) {
                    case 'rooms':
                        if (this.isAdmin()) this.loadRoomsForAdmin();
                        break;
                    case 'access':
                        if (this.isAdmin()) this.loadAccessList();
                        break;
                    case 'bookings':
                        this.loadAllBookings();
                        break;
                    case 'stats':
                        if (this.isManager()) this.loadManagerStats();
                        break;
                }
            } else {
                // Если нет активной вкладки, показываем первую доступную
                if (this.isAdmin()) {
                    this.switchTab('rooms');
                } else if (this.isManager()) {
                    this.switchTab('bookings');
                }
            }
        }, 100);
    }
    updateAdminTabsVisibility() {
        const tabs = document.querySelectorAll('.tab-btn');
        const adminPanelTitle = document.getElementById('adminPanelTitle');
        const managerPanelTitle = document.getElementById('managerPanelTitle');
        const statsTab = document.querySelector('[data-tab="stats"]');
        
        // Сначала показываем все вкладки
        tabs.forEach(tab => {
            tab.style.display = 'inline-block';
        });
        
        // Настраиваем заголовки
        if (this.isAdmin()) {
            if (adminPanelTitle) {
                adminPanelTitle.style.display = 'inline';
                managerPanelTitle.style.display = 'none';
            }
            // Показываем все вкладки кроме stats для админа
            if (statsTab) statsTab.style.display = 'none';
        } 
        else if (this.isManager()) {
            if (adminPanelTitle) {
                adminPanelTitle.style.display = 'none';
                managerPanelTitle.style.display = 'inline';
            }
            
            // Менеджеру показываем только bookings и stats
            tabs.forEach(tab => {
                const tabName = tab.dataset.tab;
                if (tabName !== 'bookings' && tabName !== 'stats') {
                    tab.style.display = 'none';
                }
            });
            
            // Показываем stats для менеджера
            if (statsTab) statsTab.style.display = 'inline-block';
        }
        else {
            // Пользователю не показываем ничего
            tabs.forEach(tab => {
                tab.style.display = 'none';
            });
        }
    }
// В методе switchTab добавьте проверку:
switchTab(tabName) {
    console.log(`🔄 Переключение на вкладку: ${tabName}`);
    
    // Обновляем активные вкладки
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.tab === tabName) {
            btn.classList.add('active');
        }
    });

    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
        if (content.id === `${tabName}-tab`) {
            content.classList.add('active');
            
            // Загружаем данные для вкладки
            switch(tabName) {
                case 'rooms':
                    if (this.isAdmin()) {
                        setTimeout(() => this.loadRoomsForAdmin(), 100);
                    }
                    break;
                case 'access':
                    if (this.isAdmin()) {
                        // Даем время DOM для отображения
                        setTimeout(() => {
                            this.loadAccessList();
                        }, 150);
                    }
                    break;
                case 'bookings':
                    setTimeout(() => this.loadAllBookings(), 100);
                    break;
                case 'stats':
                    if (this.isManager()) {
                        setTimeout(() => this.loadManagerStats(), 100);
                    }
                    break;
            }
        }
    });
}
canAccessTab(tabName) {
    if (this.isAdmin()) {
        return true; // Админ имеет доступ ко всем вкладкам
    } else if (this.isManager()) {
        // Менеджеру доступны только bookings и stats
        return tabName === 'bookings' || tabName === 'stats';
    }
    return false;
}
// Добавьте метод загрузки статистики для менеджера:
async loadManagerStats() {
    console.log("📊 Загрузка статистики для менеджера...");
    try {
        const response = await fetch('/api/bookings/');
        if (response.ok) {
            const allBookings = await response.json();
            const today = new Date().toISOString().split('T')[0];
            
            // Статистика
            const todayBookings = allBookings.filter(b => b.date === today);
            const upcomingBookings = allBookings.filter(b => b.date >= today);
            
            // Обновляем статистику на странице
            document.getElementById('totalBookings').textContent = allBookings.length;
            document.getElementById('todayBookings').textContent = todayBookings.length;
            document.getElementById('upcomingBookings').textContent = upcomingBookings.length;
            
            // Показываем блок статистики
            document.getElementById('manager-dashboard').style.display = 'block';
        }
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

updateUserDisplay() {
    if (this.currentUser) {
        document.querySelector('.user-name').textContent = this.currentUser.name;
        
        const adminNavBtn = document.getElementById('adminNavBtn');
        const managerNavBtn = document.getElementById('managerNavBtn');
        
        if (this.isAdmin()) {
            adminNavBtn.style.display = 'inline-block';
            managerNavBtn.style.display = 'none';
        } else if (this.isManager()) {
            adminNavBtn.style.display = 'none';
            managerNavBtn.style.display = 'inline-block';
        } else {
            adminNavBtn.style.display = 'none';
            managerNavBtn.style.display = 'none';
        }
    }
}
logout() {
    console.log("🚪 Выход из системы...");
    
    try {
        // Останавливаем опрос сервера
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
        
        // ⭐⭐⭐ УДАЛЯЕМ ТОЛЬКО ПОЛЬЗОВАТЕЛЯ, А НЕ ВСЕ ⭐⭐⭐
        localStorage.removeItem('soveshaika_user');
        
        // Сбрасываем состояние
        this.currentUser = null;
        this.rooms = [];
        this.bookings = [];
        
        // Обновляем интерфейс
        const userNameElement = document.querySelector('.user-name');
        if (userNameElement) {
            userNameElement.textContent = 'Пользователь';
        }
        
        const adminBtn = document.querySelector('[data-view="admin"]');
        if (adminBtn) {
            adminBtn.style.display = 'none';
        }
        
        // Показываем форму авторизации
        this.switchView('auth');
        
        this.showNotification('Вы вышли из системы', 'info');
        
        console.log("✅ Выход выполнен успешно");
        
    } catch (error) {
        console.error("❌ Ошибка при выходе:", error);
        // Только в крайнем случае очищаем все
        localStorage.clear();
        window.location.reload();
    }
}

    updateProfile() {
        console.log("👤 Обновление профиля...");
        
        if (!this.currentUser) {
            this.showNotification('Пользователь не авторизован', 'error');
            return;
        }
        
        // Обновляем информацию о текущем пользователе
        const displayName = document.getElementById('displayName');
        const displayEmail = document.getElementById('displayEmail');
        const displayRole = document.getElementById('displayRole');
        const displayCreatedAt = document.getElementById('displayCreatedAt');
        
        if (displayName) {
            displayName.textContent = this.currentUser.name || 
                `${this.currentUser.firstName} ${this.currentUser.lastName}`;
        }
        
        if (displayEmail) {
            displayEmail.textContent = this.currentUser.email || '';
        }
        
        if (displayRole) {
            displayRole.textContent = this.getRoleLabel(this.currentUser.role) || 'Пользователь';
        }
        
        if (displayCreatedAt) {
            if (this.currentUser.createdAt) {
                const date = new Date(this.currentUser.createdAt);
                displayCreatedAt.textContent = date.toLocaleDateString('ru-RU', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                });
            } else {
                displayCreatedAt.textContent = 'Неизвестно';
            }
        }
        
        // Загружаем бронирования пользователя
        this.loadMyBookings();
    }
    
    // Новый метод для загрузки бронирований пользователя
    async loadMyBookings() {
        if (!this.currentUser) return;
        
        try {
            console.log(`📅 Загрузка бронирований для пользователя ${this.currentUser.id}...`);
            const response = await fetch(`/api/bookings/?user_id=${this.currentUser.id}`);
            
            if (response.ok) {
                const bookings = await response.json();
                console.log(`✅ Загружено ${bookings.length} бронирований пользователя`);
                this.myBookings = bookings;
                this.renderMyBookings('all'); // Показываем все по умолчанию
            } else {
                console.error('❌ Ошибка загрузки бронирований пользователя');
                this.renderNoBookings();
            }
        } catch (error) {
            console.error('❌ Ошибка сети при загрузке бронирований:', error);
            this.renderNoBookings();
        }
    }
    
    // Метод для отрисовки бронирований пользователя
    renderMyBookings(filter = 'all') {
        const container = document.getElementById('myBookingsList');
        if (!container) return;
        
        if (!this.myBookings || this.myBookings.length === 0) {
            this.renderNoBookings();
            return;
        }
        
        // Сортируем бронирования по дате (сначала предстоящие)
        const sortedBookings = [...this.myBookings].sort((a, b) => {
            if (a.date === b.date) {
                return a.startTime.localeCompare(b.startTime);
            }
            return a.date.localeCompare(b.date);
        });
        
        // Фильтруем по выбранному фильтру
        const today = new Date().toISOString().split('T')[0];
        const currentTime = new Date().toLocaleTimeString('ru-RU', { hour12: false, hour: '2-digit', minute: '2-digit' });
        
        const filteredBookings = sortedBookings.filter(booking => {
            if (filter === 'all') return true;
            if (filter === 'today') return booking.date === today;
            if (filter === 'upcoming') return booking.date >= today;
            if (filter === 'past') return booking.date < today;
            return true;
        });
        
        container.innerHTML = '';
        
        if (filteredBookings.length === 0) {
            this.renderNoBookings(filter);
            return;
        }
        
        // Обновляем активные кнопки фильтра
        document.querySelectorAll('.bookings-filter .btn-small').forEach(btn => {
            btn.classList.remove('active');
            if (btn.textContent.toLowerCase().includes(filter)) {
                btn.classList.add('active');
            }
        });
        
        filteredBookings.forEach(booking => {
            const bookingElement = this.createBookingElement(booking, today, currentTime);
            container.appendChild(bookingElement);
        });
    }
    
    // Создание элемента бронирования
    createBookingElement(booking, today, currentTime) {
        const room = this.rooms.find(r => r.id === booking.roomId);
        const roomName = room ? room.name : 'Неизвестная комната';
        
        const isToday = booking.date === today;
        const isPast = booking.date < today || (isToday && booking.endTime < currentTime);
        const isActive = isToday && booking.startTime <= currentTime && booking.endTime > currentTime;
        const isUpcoming = booking.date > today || (isToday && booking.startTime > currentTime);
        
        const statusClass = isPast ? 'past' : isActive ? 'active' : 'upcoming';
        const statusText = isPast ? 'Завершено' : isActive ? 'Идет сейчас' : 'Предстоящее';
        
        const bookingElement = document.createElement('div');
        bookingElement.className = `my-booking-item ${isPast ? 'past' : ''}`;
        
        bookingElement.innerHTML = `
            <div class="my-booking-header">
                <h4 class="booking-title">${booking.title}</h4>
                <span class="booking-status status-${statusClass}">${statusText}</span>
            </div>
            
            <div class="booking-details">
                <div class="booking-detail">
                    <span class="label">Комната:</span>
                    <span class="value">${roomName}</span>
                </div>
                <div class="booking-detail">
                    <span class="label">Дата:</span>
                    <span class="value">${this.formatDate(booking.date)}</span>
                </div>
                <div class="booking-detail">
                    <span class="label">Время:</span>
                    <span class="value">${booking.startTime} - ${booking.endTime}</span>
                </div>
                <div class="booking-detail">
                    <span class="label">Продолжительность:</span>
                    <span class="value">${this.calculateDuration(booking.startTime, booking.endTime)}</span>
                </div>
            </div>
            
            ${booking.participants && booking.participants.length > 0 ? `
                <div class="booking-participants">
                    <strong>Участники:</strong> ${booking.participants.join(', ')}
                </div>
            ` : ''}
            
            <div class="booking-actions">
                ${!isPast ? `
                    <button class="btn btn-danger btn-small" onclick="window.app.cancelMyBooking('${booking.id}')">
                        Отменить
                    </button>
                ` : ''}
                <button class="btn btn-secondary btn-small" onclick="window.app.viewBookingDetails('${booking.id}'); return false;">
                        Детали
                </button>
            </div>
        `;
        
        return bookingElement;
    }
    
    // Вспомогательные методы
    formatDate(dateStr) {
        const date = new Date(dateStr);
        const today = new Date().toISOString().split('T')[0];
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
        const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
        
        if (dateStr === today) return 'Сегодня';
        if (dateStr === yesterday) return 'Вчера';
        if (dateStr === tomorrow) return 'Завтра';
        
        return date.toLocaleDateString('ru-RU', {
            weekday: 'short',
            day: 'numeric',
            month: 'long'
        });
    }
    
    calculateDuration(startTime, endTime) {
        const start = this.timeToMinutes(startTime);
        const end = this.timeToMinutes(endTime);
        const duration = end - start;
        
        const hours = Math.floor(duration / 60);
        const minutes = duration % 60;
        
        if (hours > 0 && minutes > 0) {
            return `${hours} ч ${minutes} мин`;
        } else if (hours > 0) {
            return `${hours} ч`;
        } else {
            return `${minutes} мин`;
        }
    }
    
    renderNoBookings(filter = 'all') {
        const container = document.getElementById('myBookingsList');
        if (!container) return;
        
        let message = '';
        let icon = '📅';
        
        switch(filter) {
            case 'all':
                message = 'У вас еще нет бронирований';
                icon = '📅';
                break;
            case 'today':
                message = 'На сегодня бронирований нет';
                icon = '📆';
                break;
            case 'upcoming':
                message = 'Нет предстоящих бронирований';
                icon = '🔮';
                break;
            case 'past':
                message = 'Нет прошедших бронирований';
                icon = '📜';
                break;
        }
        
        container.innerHTML = `
            <div class="no-bookings">
                <div class="no-bookings-icon">${icon}</div>
                <h4>${message}</h4>
                <p class="text-muted">Создайте свое первое бронирование на вкладке "Расписание"</p>
                <button class="btn btn-primary" onclick="window.app.switchView('dashboard')">
                    Перейти к бронированию
                </button>
            </div>
        `;
    }
    
    // Метод для фильтрации бронирований
    filterMyBookings(filter) {
        this.renderMyBookings(filter);
    }
    
    // Метод для отмены своего бронирования
    async cancelMyBooking(bookingId) {
        if (!confirm('Вы уверены, что хотите отменить это бронирование?')) {
            return;
        }
        
        try {
            const response = await fetch(`/api/bookings/${bookingId}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                this.showNotification('Бронирование отменено', 'success');
                // Обновляем список бронирований
                await this.loadMyBookings();
            } else {
                const error = await response.json();
                this.showNotification(error.detail || 'Ошибка отмены бронирования', 'error');
            }
        } catch (error) {
            console.error('Error deleting booking:', error);
            this.showNotification('Ошибка сети', 'error');
        }
    }
    
// Добавьте этот метод в класс SoveshaikaApp
async viewBookingDetails(bookingId) {
    console.log(`🔍 Просмотр деталей бронирования: ${bookingId}`);
    
    try {
        const response = await fetch(`/api/bookings/${bookingId}`);
        if (response.ok) {
            const booking = await response.json();
            console.log('📊 Данные бронирования:', booking);
            this.showBookingDetailsModal(booking);
        } else {
            const error = await response.json();
            console.error('❌ Ошибка загрузки деталей:', error);
            this.showNotification('Не удалось загрузить детали бронирования', 'error');
        }
    } catch (error) {
        console.error('❌ Ошибка сети при загрузке деталей:', error);
        this.showNotification('Ошибка сети', 'error');
    }
}

// Метод для показа модального окна с деталями
showBookingDetailsModal(booking) {
    console.log('🔄 Создание модального окна для бронирования:', booking.id);
    
    // Находим комнату и пользователя
    const room = this.rooms.find(r => r.id === booking.roomId);
    const user = this.users.find(u => u.id === booking.userId);
    
    // Форматируем дату
    const bookingDate = new Date(booking.date);
    const formattedDate = bookingDate.toLocaleDateString('ru-RU', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
    
    // Определяем статус
    const today = new Date().toISOString().split('T')[0];
    const currentTime = new Date().toLocaleTimeString('ru-RU', { 
        hour12: false, 
        hour: '2-digit', 
        minute: '2-digit' 
    });
    
    let status = '';
    let statusClass = '';
    
    if (booking.date < today) {
        status = 'Завершено';
        statusClass = 'past';
    } else if (booking.date > today) {
        status = 'Запланировано';
        statusClass = 'upcoming';
    } else {
        if (booking.startTime <= currentTime && booking.endTime > currentTime) {
            status = 'Идет сейчас';
            statusClass = 'active';
        } else if (booking.endTime < currentTime) {
            status = 'Завершено';
            statusClass = 'past';
        } else {
            status = 'Запланировано на сегодня';
            statusClass = 'upcoming';
        }
    }
    
    // HTML модального окна
    const modalHtml = `
        <div class="modal-overlay active" id="bookingDetailsModal">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>${booking.title}</h3>
                    <button class="modal-close" onclick="window.app.closeBookingDetailsModal()">×</button>
                </div>
                
                <div class="modal-body">
                    <div class="status-badge ${statusClass}">${status}</div>
                    
                    <div class="detail-section">
                        <h4>Основная информация</h4>
                        <div class="detail-row">
                            <span class="detail-label">Комната:</span>
                            <span class="detail-value">${room ? room.name : 'Неизвестная'}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Дата:</span>
                            <span class="detail-value">${formattedDate}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Время:</span>
                            <span class="detail-value">${booking.startTime} - ${booking.endTime}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Продолжительность:</span>
                            <span class="detail-value">${this.calculateDuration(booking.startTime, booking.endTime)}</span>
                        </div>
                    </div>
                    
                    <div class="detail-section">
                        <h4>Организатор и участники</h4>
                        <div class="detail-row">
                            <span class="detail-label">Организатор:</span>
                            <span class="detail-value">${booking.userName || (user ? user.name : 'Неизвестный')}</span>
                        </div>
                        ${booking.participants && booking.participants.length > 0 ? `
                            <div class="detail-row">
                                <span class="detail-label">Участники:</span>
                                <span class="detail-value">
                                    ${booking.participants.map(p => `<div class="participant">${p}</div>`).join('')}
                                </span>
                            </div>
                        ` : `
                            <div class="detail-row">
                                <span class="detail-label">Участники:</span>
                                <span class="detail-value text-muted">Не указаны</span>
                            </div>
                        `}
                    </div>
                    
                    ${room ? `
                        <div class="detail-section">
                            <h4>Информация о комнате</h4>
                            <div class="detail-row">
                                <span class="detail-label">Вместимость:</span>
                                <span class="detail-value">${room.capacity} человек</span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">Цена:</span>
                                <span class="detail-value">${room.price} руб/час</span>
                            </div>
                            ${room.amenities ? `
                                <div class="detail-row">
                                    <span class="detail-label">Оборудование:</span>
                                    <span class="detail-value">${room.amenities}</span>
                                </div>
                            ` : ''}
                        </div>
                    ` : ''}
                    
                    <div class="detail-section">
                        <h4>Техническая информация</h4>
                        <div class="detail-row">
                            <span class="detail-label">ID бронирования:</span>
                            <span class="detail-value"><code>${booking.id}</code></span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Создано:</span>
                            <span class="detail-value">${new Date(booking.createdAt).toLocaleString('ru-RU')}</span>
                        </div>
                    </div>
                </div>
                
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="window.app.closeBookingDetailsModal()">
                        Закрыть
                    </button>
                    
                    ${this.canCancelBooking(booking) ? `
                        <button class="btn btn-danger" 
                                onclick="window.app.cancelBookingFromModal('${booking.id}')">
                            Отменить бронирование
                        </button>
                    ` : ''}
                    
                    <button class="btn btn-primary" 
                            onclick="window.app.copyBookingDetails('${booking.id}')">
                        Копировать информацию
                    </button>
                </div>
            </div>
        </div>
    `;
    
    // Создаем и добавляем модальное окно
    const modalContainer = document.createElement('div');
    modalContainer.innerHTML = modalHtml;
    modalContainer.id = 'bookingDetailsModalContainer';
    document.body.appendChild(modalContainer);
    
    // Добавляем стили если их еще нет
    this.addModalStyles();
}

// Метод для проверки возможности отмены
canCancelBooking(booking) {
    if (!this.currentUser) return false;
    
    // Админ и менеджер могут отменять любые бронирования
    if (this.isAdminOrManager()) return true;
    
    // Пользователь может отменять только свои бронирования
    if (this.currentUser.id === booking.userId) {
        // Проверяем, что бронирование еще не началось
        const today = new Date().toISOString().split('T')[0];
        const currentTime = new Date().toLocaleTimeString('ru-RU', { 
            hour12: false, 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        if (booking.date > today) return true;
        if (booking.date === today && booking.startTime > currentTime) return true;
    }
    
    return false;
}

// Метод отмены бронирования из модального окна
async cancelBookingFromModal(bookingId) {
    if (!confirm('Вы уверены, что хотите отменить это бронирование?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/bookings/${bookingId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            this.showNotification('Бронирование отменено', 'success');
            this.closeBookingDetailsModal();
            
            // Обновляем данные
            if (document.getElementById('profile')?.classList.contains('active')) {
                await this.loadMyBookings();
            }
            if (document.getElementById('admin')?.classList.contains('active')) {
                await this.loadAllBookings();
            }
        } else {
            const error = await response.json();
            this.showNotification(error.detail || 'Ошибка отмены бронирования', 'error');
        }
    } catch (error) {
        console.error('Error deleting booking:', error);
        this.showNotification('Ошибка сети', 'error');
    }
}

// Метод копирования информации о бронировании
copyBookingDetails(bookingId) {
    const booking = this.myBookings?.find(b => b.id === bookingId) || 
                    this.bookings?.find(b => b.id === bookingId);
    
    if (!booking) {
        this.showNotification('Информация о бронировании не найдена', 'error');
        return;
    }
    
    const room = this.rooms.find(r => r.id === booking.roomId);
    const text = `Бронирование: ${booking.title}
Комната: ${room ? room.name : 'Неизвестная'}
Дата: ${booking.date}
Время: ${booking.startTime} - ${booking.endTime}
Организатор: ${booking.userName || 'Неизвестный'}
Участники: ${booking.participants?.join(', ') || 'Не указаны'}`;
    
    navigator.clipboard.writeText(text).then(() => {
        this.showNotification('Информация скопирована в буфер обмена', 'success');
    }).catch(err => {
        console.error('Ошибка копирования:', err);
        this.showNotification('Не удалось скопировать информацию', 'error');
    });
}

// Метод закрытия модального окна
closeBookingDetailsModal() {
    const modalContainer = document.getElementById('bookingDetailsModalContainer');
    if (modalContainer) {
        modalContainer.remove();
    }
}

// Добавление стилей для модального окна
addModalStyles() {
    // Проверяем, добавлены ли стили уже
    if (document.getElementById('modal-styles')) return;
    
    const styles = `
        /* Стили для модального окна */
        .modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            padding: 20px;
            animation: fadeIn 0.3s ease;
        }
        
        .modal-overlay.active {
            display: flex;
        }
        
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        
        .modal-content {
            background: white;
            border-radius: 12px;
            width: 100%;
            max-width: 600px;
            max-height: 90vh;
            overflow-y: auto;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            animation: slideUp 0.3s ease;
        }
        
        @keyframes slideUp {
            from { transform: translateY(50px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
        }
        
        .modal-header {
            padding: 1.5rem;
            border-bottom: 1px solid var(--border-color);
            display: flex;
            justify-content: space-between;
            align-items: center;
            position: sticky;
            top: 0;
            background: white;
            z-index: 1;
            border-radius: 12px 12px 0 0;
        }
        
        .modal-header h3 {
            margin: 0;
            color: var(--text-color);
            font-size: 1.5rem;
            font-weight: 600;
        }
        
        .modal-close {
            background: none;
            border: none;
            font-size: 2rem;
            cursor: pointer;
            color: var(--text-secondary);
            line-height: 1;
            width: 40px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 50%;
            transition: all 0.2s;
        }
        
        .modal-close:hover {
            background: var(--background-color);
            color: var(--text-color);
        }
        
        .modal-body {
            padding: 1.5rem;
        }
        
        .status-badge {
            display: inline-block;
            padding: 0.5rem 1rem;
            border-radius: 2rem;
            font-size: 0.875rem;
            font-weight: 600;
            margin-bottom: 1.5rem;
        }
        
        .status-badge.past {
            background: #f3f4f6;
            color: #6b7280;
        }
        
        .status-badge.active {
            background: #dcfce7;
            color: #166534;
        }
        
        .status-badge.upcoming {
            background: #dbeafe;
            color: #1e40af;
        }
        
        .detail-section {
            margin-bottom: 2rem;
        }
        
        .detail-section h4 {
            font-size: 1.1rem;
            color: var(--text-color);
            margin-bottom: 1rem;
            padding-bottom: 0.5rem;
            border-bottom: 2px solid var(--border-color);
        }
        
        .detail-row {
            display: flex;
            margin-bottom: 0.75rem;
            align-items: flex-start;
        }
        
        .detail-label {
            font-weight: 500;
            color: var(--text-secondary);
            min-width: 140px;
            flex-shrink: 0;
        }
        
        .detail-value {
            color: var(--text-color);
            flex: 1;
        }
        
        .detail-value code {
            background: var(--background-color);
            padding: 0.25rem 0.5rem;
            border-radius: 4px;
            font-family: monospace;
            font-size: 0.875rem;
        }
        
        .participant {
            background: #f3f4f6;
            padding: 0.25rem 0.75rem;
            border-radius: 1rem;
            display: inline-block;
            margin: 0.25rem;
            font-size: 0.875rem;
        }
        
        .text-muted {
            color: var(--text-secondary) !important;
            font-style: italic;
        }
        
        .modal-footer {
            padding: 1.5rem;
            border-top: 1px solid var(--border-color);
            display: flex;
            gap: 0.75rem;
            justify-content: flex-end;
            position: sticky;
            bottom: 0;
            background: white;
            border-radius: 0 0 12px 12px;
        }
        
        /* Адаптивность */
        @media (max-width: 768px) {
            .modal-content {
                max-width: 100%;
                max-height: 95vh;
            }
            
            .detail-row {
                flex-direction: column;
                gap: 0.25rem;
            }
            
            .detail-label {
                min-width: auto;
            }
            
            .modal-footer {
                flex-direction: column;
            }
            
            .modal-footer .btn {
                width: 100%;
            }
        }
    `;
    
    const styleElement = document.createElement('style');
    styleElement.id = 'modal-styles';
    styleElement.textContent = styles;
    document.head.appendChild(styleElement);
}
    
    closeModal() {
        const modal = document.querySelector('.modal-overlay');
        if (modal) {
            modal.remove();
        }
    }
    switchAuthMode(mode) {
        console.log(`🔄 Переключение режима авторизации на: ${mode}`);
        
        // Скрываем все формы
        document.querySelectorAll('.auth-form').forEach(form => {
            form.classList.remove('active');
        });
        
        // Показываем нужную форму
        if (mode === 'login') {
            document.getElementById('loginForm').classList.add('active');
        } else if (mode === 'register') {
            document.getElementById('registerForm').classList.add('active');
        }
        
        // Фокусируемся на первом поле
        setTimeout(() => {
            if (mode === 'login') {
                const emailInput = document.getElementById('loginEmail');
                if (emailInput) emailInput.focus();
            } else if (mode === 'register') {
                const firstNameInput = document.getElementById('registerFirstName');
                if (firstNameInput) firstNameInput.focus();
            }
        }, 100);
    }

    switchLoginMode(mode) {
        document.querySelectorAll('.auth-tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.auth-login-mode').forEach(m => m.classList.remove('active'));
        
        if (mode === 'list') {
            document.querySelectorAll('.auth-tab-btn')[0].classList.add('active');
            document.getElementById('loginList').classList.add('active');
        } else {
            document.querySelectorAll('.auth-tab-btn')[1].classList.add('active');
            document.getElementById('loginPasswordForm').classList.add('active'); // Исправленный ID
        }
    }

    // Оставляем только этот метод для входа:
    async passwordLogin() {
        if (this.isProcessingLogin) {
            console.log("⏳ Вход уже выполняется...");
            return;
        }
        
        const loginButton = document.getElementById('loginButton');
        const loginButtonText = document.getElementById('loginButtonText');
        const loginLoading = document.getElementById('loginLoading');
    
        if (loginButton && loginButtonText && loginLoading) {
            loginButton.disabled = true;
            loginButtonText.style.display = 'none';
            loginLoading.style.display = 'inline';
        }
    
        this.isProcessingLogin = true;
        
        try {
            const email = document.getElementById('loginEmail').value.trim().toLowerCase();
            const password = document.getElementById('loginPassword').value.trim();
    
            // Сначала валидация на фронтенде
            const validationErrors = [];
            
            // Проверка email
            if (!email) {
                validationErrors.push('Введите email адрес');
                document.getElementById('loginEmail').classList.add('input-error');
            } else if (email.length > 100) {
                validationErrors.push('Email слишком длинный (максимум 100 символов)');
                document.getElementById('loginEmail').classList.add('input-error');
            } else if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)) {
                validationErrors.push('Неверный формат email адреса (пример: user@example.com)');
                document.getElementById('loginEmail').classList.add('input-error');
            } else {
                document.getElementById('loginEmail').classList.remove('input-error');
            }
            
            // Проверка пароля
            if (!password) {
                validationErrors.push('Введите пароль');
                document.getElementById('loginPassword').classList.add('input-error');
            } else if (password.length > 100) {
                validationErrors.push('Пароль слишком длинный (максимум 100 символов)');
                document.getElementById('loginPassword').classList.add('input-error');
            } else {
                document.getElementById('loginPassword').classList.remove('input-error');
            }
            
            // Если есть ошибки валидации на фронтенде
            if (validationErrors.length > 0) {
                validationErrors.forEach(error => {
                    this.showNotification(error, 'error');
                });
                
                // Анимация тряски для формы
                document.getElementById('loginForm').classList.add('shake');
                setTimeout(() => {
                    document.getElementById('loginForm').classList.remove('shake');
                }, 500);
                
                return; // Выходим из метода
            }
    
            // Отправка запроса на сервер
            const response = await fetch('/api/users/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
    
            if (response.ok) {
                const user = await response.json();
                this.currentUser = user;
                localStorage.setItem('soveshaika_user', JSON.stringify(user));
                this.updateUserDisplay();
                
                // Очищаем форму
                document.getElementById('loginEmail').value = '';
                document.getElementById('loginPassword').value = '';
                
                // Убираем классы ошибок
                document.getElementById('loginEmail').classList.remove('input-error');
                document.getElementById('loginPassword').classList.remove('input-error');
                
                await this.loadRooms();
                this.switchView('home');
                
                this.showNotification(`Вход выполнен как ${user.name}`, 'success');
                
            } else {
                // Детальная обработка ошибок от сервера
                let errorMessage = 'Ошибка входа';
                
                try {
                    const errorData = await response.json();
                    console.log('❌ Ошибка от сервера:', errorData);
                    
                    // Определяем сообщение в зависимости от статуса и содержимого
                    if (response.status === 400) {
                        // Ошибки валидации от Pydantic
                        if (errorData.detail) {
                            if (Array.isArray(errorData.detail)) {
                                errorMessage = errorData.detail.map(err => err.msg).join(', ');
                            } else {
                                errorMessage = errorData.detail;
                            }
                        }
                    } else if (response.status === 401) {
                        // Неверные учетные данные
                        errorMessage = errorData.detail || 'Неверный email или пароль';
                    } else if (response.status === 404) {
                        errorMessage = 'Пользователь не найден';
                    } else if (response.status === 422) {
                        errorMessage = 'Неверный формат данных';
                    } else if (response.status >= 500) {
                        errorMessage = 'Внутренняя ошибка сервера. Попробуйте позже';
                    }
                    
                } catch (parseError) {
                    console.error('Ошибка парсинга ответа:', parseError);
                    errorMessage = 'Ошибка сервера. Попробуйте позже';
                }
                
                this.showNotification(errorMessage, 'error');
                
                // Подсвечиваем поля при ошибке
                document.getElementById('loginEmail').classList.add('input-error');
                document.getElementById('loginPassword').classList.add('input-error');
                
                // Анимация тряски
                document.getElementById('loginForm').classList.add('shake');
                setTimeout(() => {
                    document.getElementById('loginForm').classList.remove('shake');
                }, 500);
            }
            
        } catch (networkError) {
            console.error('Ошибка сети:', networkError);
            
            let errorMessage = 'Ошибка сети';
            if (networkError.message.includes('Failed to fetch')) {
                errorMessage = 'Не удалось подключиться к серверу. Проверьте подключение к интернету';
            } else if (networkError.message.includes('timeout')) {
                errorMessage = 'Время ожидания истекло. Сервер не отвечает';
            }
            
            this.showNotification(errorMessage, 'error');
            
            // Подсвечиваем все поля при ошибке сети
            document.getElementById('loginEmail').classList.add('input-error');
            document.getElementById('loginPassword').classList.add('input-error');
            
        } finally {
            // Восстанавливаем кнопку всегда, независимо от результата
            if (loginButton && loginButtonText && loginLoading) {
                loginButton.disabled = false;
                loginButtonText.style.display = 'inline';
                loginLoading.style.display = 'none';
            }
            this.isProcessingLogin = false;
        }
    }
    // Методы валидации для формы логина
validateLoginEmail(input) {
    const value = input.value.trim().toLowerCase();
    const hint = input.nextElementSibling;
    
    if (!value) {
        input.classList.remove('input-error');
        if (hint) {
            hint.className = 'form-hint';
            hint.textContent = 'Введите корректный email адрес';
        }
        return false;
    }
    
    if (value.length > 100) {
        input.classList.add('input-error');
        if (hint) {
            hint.className = 'form-hint invalid';
            hint.textContent = 'Email слишком длинный (максимум 100 символов)';
        }
        return false;
    }
    
    if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(value)) {
        input.classList.add('input-error');
        if (hint) {
            hint.className = 'form-hint invalid';
            hint.textContent = 'Неверный формат email адреса (пример: user@example.com)';
        }
        return false;
    }
    
    input.classList.remove('input-error');
    if (hint) {
        hint.className = 'form-hint valid';
        hint.textContent = 'Email корректный';
    }
    return true;
}

validateLoginPassword(input) {
    const value = input.value.trim();
    const hint = input.nextElementSibling;
    
    if (!value) {
        input.classList.remove('input-error');
        if (hint) {
            hint.className = 'form-hint';
            hint.textContent = 'Введите ваш пароль';
        }
        return false;
    }
    
    if (value.length > 100) {
        input.classList.add('input-error');
        if (hint) {
            hint.className = 'form-hint invalid';
            hint.textContent = 'Пароль слишком длинный (максимум 100 символов)';
        }
        return false;
    }
    
    input.classList.remove('input-error');
    if (hint) {
        hint.className = 'form-hint valid';
        hint.textContent = 'Пароль введен';
    }
    return true;
}
    updateAdminPanel() {
        console.log("🛠 Инициализация панели управления");
        
        // Показываем/скрываем вкладки в зависимости от роли
        this.updateAdminTabsVisibility();
        
        // Загружаем данные для активной вкладки
        const activeTab = document.querySelector('.tab-btn.active');
        if (activeTab) {
            const tabName = activeTab.dataset.tab;
            
            switch(tabName) {
                case 'rooms':
                    if (this.isAdmin()) this.loadRoomsForAdmin();
                    break;
                case 'access':
                    if (this.isAdmin()) this.loadAccessList();
                    break;
                case 'bookings':
                    this.loadAllBookings();
                    break;
                case 'stats':
                    if (this.isManager()) this.loadManagerStats();
                    break;
            }
        } else {
            // Если нет активной вкладки, показываем первую доступную
            if (this.isAdmin()) {
                this.switchTab('rooms');
            } else if (this.isManager()) {
                this.switchTab('bookings');
            }
        }
    }

    switchTab(tabName) {
        console.log(`🔄 Переключение на вкладку: ${tabName}`);
        
        // Показываем/скрываем вкладки
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.tab === tabName) {
                btn.classList.add('active');
            }
        });
    
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
            if (content.id === `${tabName}-tab`) {
                content.classList.add('active');
                
                // Загружаем данные для вкладки
                switch(tabName) {
                    case 'rooms':
                        if (this.isAdmin()) this.loadRoomsForAdmin();
                        break;
                    case 'access':
                        if (this.isAdmin()) this.loadAccessList();
                        break;
                    case 'bookings':
                        this.loadAllBookings();
                        break;
                    case 'stats':
                        if (this.isManager()) this.loadManagerStats();
                        break;
                }
            }
        });
    }
    async loadManagerStats() {
        console.log("📊 Загрузка статистики для менеджера...");
        try {
            const response = await fetch('/api/bookings/');
            if (response.ok) {
                const allBookings = await response.json();
                const today = new Date().toISOString().split('T')[0];
                
                // Статистика
                const todayBookings = allBookings.filter(b => b.date === today);
                const upcomingBookings = allBookings.filter(b => b.date >= today);
                
                // Обновляем статистику на странице
                document.getElementById('totalBookings').textContent = allBookings.length;
                document.getElementById('todayBookings').textContent = todayBookings.length;
                document.getElementById('upcomingBookings').textContent = upcomingBookings.length;
                
                // Показываем блок статистики
                document.getElementById('manager-dashboard').style.display = 'block';
            }
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    }
}

window.app = new SoveshaikaApp();
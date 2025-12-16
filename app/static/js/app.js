import { initializeAuth, getCurrentUser, logout, isAdmin, getAllUsers, setCurrentUser, createUser, loginWithPassword } from './auth.js';
import { showNotification } from './notifications.js';

class SoveshaikaApp {
    constructor() {
        this.currentUser = null;
        this.rooms = [];
        this.bookings = [];
        this.users = [];
        this.allUsers = [];
        this.timeSlots = this.generateTimeSlots(); // Перенесено в конструктор
        
        this.init();
    }
    
    // Генерация временных слотов
    generateTimeSlots() {
        const slots = [];
        for (let hour = 9; hour <= 18; hour++) {
            for (let minute of ['00', '30']) {
                const time = `${hour.toString().padStart(2, '0')}:${minute}`;
                const display = `${hour}:${minute}`;
                slots.push({ time, display });
            }
        }
        return slots;
    }
    
    async init() {
        console.log("🚀 Инициализация приложения...");
        
        // Инициализируем аутентификацию
        await initializeAuth();
        
        // Получаем текущего пользователя
        this.currentUser = getCurrentUser();
        this.users = getAllUsers();
        
        // Настраиваем обработчики событий
        this.setupEventListeners();
        this.bindEvents();
        
        // Проверяем авторизацию
        await this.checkAuthAndLoad();
        
        // Инициализируем данные если пользователь авторизован
        if (this.currentUser) {
            this.updateUserDisplay();
            await this.loadRooms();
        }
    }
    
    // НОВЫЙ МЕТОД: проверка авторизации и загрузка данных
    async checkAuthAndLoad() {
        console.log("🔐 Проверка авторизации...");
        
        try {
            const userData = localStorage.getItem('soveshaika_user');
            if (userData) {
                this.currentUser = JSON.parse(userData);
                this.updateUI();
                await this.loadInitialData();
                this.switchView('home');
            } else {
                this.switchView('auth');
            }
        } catch (error) {
            console.error('❌ Ошибка проверки авторизации:', error);
            localStorage.removeItem('soveshaika_user');
            this.switchView('auth');
        }
    }
    
    async loadInitialData() {
        console.log("📦 Загрузка начальных данных...");
        await this.loadRooms();
        await this.loadAuthUsers();
    }
    
    setupEventListeners() {
        console.log("🔗 Настройка обработчиков событий...");
        
        // Навигация
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const view = e.target.dataset.view;
                this.switchView(view);
            });
        });

        // Выход
        document.querySelector('.logout-btn').addEventListener('click', () => {
            this.logout();
        });

        // Клик по имени пользователя
        document.querySelector('.user-name').addEventListener('click', () => {
            this.switchView('profile');
        });
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
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.getElementById('auth').classList.add('active');
        this.loadAuthUsersList();
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
        try {
            const response = await fetch('/api/rooms/');
            if (response.ok) {
                this.rooms = await response.json();
                this.renderRoomsList();
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
            console.error('❌ Элемент roomsList не найден');
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
                        💰 ${room.price} руб/час
                    </p>
                    <p><small>${room.amenities || 'Нет оборудования'}</small></p>
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
    
    // НОВЫЙ МЕТОД: Добавление комнаты
    async addRoom() {
        console.log("🏗️ Добавление новой комнаты...");
        
        const name = document.getElementById('roomName').value;
        const capacity = document.getElementById('roomCapacity').value;
        const amenities = document.getElementById('roomAmenities').value;
        
        if (!name || !capacity) {
            this.showNotification('Заполните название и вместимость', 'error');
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
                    amenities: amenities || '',
                    price: 0
                })
            });
            
            if (response.ok) {
                const room = await response.json();
                this.showNotification(`Комната "${room.name}" добавлена`, 'success');
                
                // Очищаем форму
                document.getElementById('roomName').value = '';
                document.getElementById('roomCapacity').value = '';
                document.getElementById('roomAmenities').value = '';
                
                // Обновляем список комнат
                await this.loadRoomsForAdmin();
            } else {
                const error = await response.json();
                this.showNotification(error.detail || 'Ошибка добавления комнаты', 'error');
            }
        } catch (error) {
            console.error('Error adding room:', error);
            this.showNotification('Ошибка сети', 'error');
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
                this.renderAccessList();
            } else {
                this.showNotification('Ошибка загрузки пользователей', 'error');
            }
        } catch (error) {
            console.error('Error loading users:', error);
            this.showNotification('Ошибка сети', 'error');
        }
    }

    renderAccessList() {
        const container = document.getElementById('accessList');
        if (!container) {
            console.error('❌ Элемент accessList не найден');
            return;
        }

        console.log(`👥 Отрисовка ${this.users.length} пользователей для управления доступом`);
        container.innerHTML = '';
        
        if (this.users.length === 0) {
            container.innerHTML = '<p class="text-muted">Нет пользователей</p>';
            return;
        }

        this.users.forEach(user => {
            const userElement = document.createElement('div');
            userElement.className = 'list-item';
            userElement.innerHTML = `
                <div class="item-info">
                    <h4>${user.name}</h4>
                    <p>${user.email}</p>
                    <p><small>Текущая роль: <strong>${this.getRoleLabel(user.role)}</strong></small></p>
                </div>
                <div class="item-actions">
                    <select class="form-control" style="width: 150px;" 
                            onchange="window.app.updateUserRole('${user.id}', this.value)">
                        <option value="user" ${user.role === 'user' ? 'selected' : ''}>Пользователь</option>
                        <option value="manager" ${user.role === 'manager' ? 'selected' : ''}>Менеджер</option>
                        <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Администратор</option>
                    </select>
                </div>
            `;
            container.appendChild(userElement);
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
                    <button class="btn btn-danger btn-small" onclick="window.app.deleteBooking('${booking.id}')">
                        Отменить
                    </button>
                </div>
            `;
            container.appendChild(bookingElement);
        });
    }

    async deleteBooking(bookingId) {
        if (!confirm('Вы уверены, что хотите отменить это бронирование?')) {
            return;
        }

        try {
            const response = await fetch(`/api/bookings/${bookingId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                this.showNotification('Бронирование отменено', 'success');
                await this.loadAllBookings();
            } else {
                const error = await response.json();
                this.showNotification(error.detail || 'Ошибка отмены бронирования', 'error');
            }
        } catch (error) {
            console.error('Error deleting booking:', error);
            this.showNotification('Ошибка сети', 'error');
        }
    }
    
    bindEvents() {
        console.log("🔗 Привязка обработчиков событий...");
        
        // Кнопка "Применить фильтры"
        const applyFiltersBtn = document.getElementById('applyFilters');
        if (applyFiltersBtn) {
            applyFiltersBtn.addEventListener('click', () => {
                this.applyFilters();
            });
        }
        
        // Кнопка "Сбросить фильтры"
        const resetFiltersBtn = document.getElementById('resetFilters');
        if (resetFiltersBtn) {
            resetFiltersBtn.addEventListener('click', () => {
                this.resetFilters();
            });
        }
        
        // Кнопка "Забронировать" в форме бронирования
        const confirmBookingBtn = document.getElementById('confirmBookingBtn');
        if (confirmBookingBtn) {
            // Удаляем старые обработчики (если есть)
            confirmBookingBtn.replaceWith(confirmBookingBtn.cloneNode(true));
            
            // Добавляем новый обработчик с защитой от повторного нажатия
            document.getElementById('confirmBookingBtn').addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log("🖱️ Кнопка 'Забронировать' нажата");
                this.confirmBooking();
            });
        }
        
        // Админка - вкладки
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tab = e.target.dataset.tab;
                this.switchTab(tab);
            });
        });
        
        // Админка - кнопка добавления комнаты
        const addRoomBtn = document.getElementById('addRoomBtn');
        if (addRoomBtn) {
            addRoomBtn.addEventListener('click', () => {
                this.addRoom();
            });
        }
        
        // Админка - кнопка обновления прав
        const updateAccessBtn = document.getElementById('updateAccessBtn');
        if (updateAccessBtn) {
            updateAccessBtn.addEventListener('click', () => {
                this.updateAccess();
            });
        }
        
        // Обновление времени при выборе даты
        const bookingDate = document.getElementById('bookingDate');
        if (bookingDate) {
            bookingDate.addEventListener('change', () => {
                this.updateTimeSlots();
            });
        }
        
        // Обновление времени при выборе комнаты
        const roomSelect = document.getElementById('roomSelect');
        if (roomSelect) {
            roomSelect.addEventListener('change', () => {
                this.updateTimeSlots();
            });
        }
        
        // Фильтры
        const filterToggle = document.getElementById('filterToggle');
        if (filterToggle) {
            filterToggle.addEventListener('click', () => {
                const panel = document.getElementById('filterPanel');
                panel.classList.toggle('active');
            });
        }
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
        console.log("🔍 Фильтрация комнат...");
        
        const statusFilters = Array.from(
            document.querySelectorAll('input[name="status"]:checked')
        ).map(cb => cb.value);
        
        const capacityFilters = Array.from(
            document.querySelectorAll('input[name="capacity"]:checked')
        ).map(cb => cb.value);
        
        const filterDate = document.getElementById('filterDate').value;
        const filterAmenities = document.getElementById('filterAmenities').value.toLowerCase();
        
        console.log("📊 Параметры фильтрации:");
        console.log("  Статус:", statusFilters);
        console.log("  Вместимость:", capacityFilters);
        console.log("  Дата:", filterDate);
        console.log("  Оборудование:", filterAmenities);
        
        if (this.rooms.length === 0) {
            console.log("❌ Нет комнат для фильтрации");
            return;
        }
        
        // Получаем бронирования для проверки занятости
        let allBookings = [];
        try {
            const response = await fetch('/api/bookings/');
            if (response.ok) {
                allBookings = await response.json();
            }
        } catch (error) {
            console.error("❌ Ошибка загрузки бронирований:", error);
        }
        
        const filteredRooms = [];
        const today = new Date().toISOString().split('T')[0];
        const checkDate = filterDate || today;
        
        for (const room of this.rooms) {
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
                // Получаем бронирования этой комнаты на выбранную дату
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
            
            if (includeRoom) {
                filteredRooms.push(room);
            }
        }
        
        console.log(`✅ Отфильтровано: ${filteredRooms.length} из ${this.rooms.length} комнат`);
        
        // Отображаем отфильтрованные комнаты
        this.renderFilteredRooms(filteredRooms, checkDate, allBookings);
        
        // Закрываем панель фильтров
        document.getElementById('filterPanel').classList.remove('active');
        
        this.showNotification(
            `Найдено ${filteredRooms.length} комнат`, 
            filteredRooms.length > 0 ? 'success' : 'info'
        );
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
            // ИСПРАВЛЕНО: используем camelCase как в схеме!
            const response = await fetch('/api/bookings/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    roomId: roomId,        // ← camelCase
                    userId: this.currentUser.id,  // ← camelCase
                    date: date,
                    startTime: startTime,  // ← camelCase
                    endTime: endTime,      // ← camelCase
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
                if (this.currentUser?.role === 'admin') {
                    this.updateAdminPanel();
                } else {
                    this.showNotification('Доступ запрещен', 'error');
                    this.switchView('home');
                }
                break;
        }
    }

    updateUserDisplay() {
        if (this.currentUser) {
            document.querySelector('.user-name').textContent = this.currentUser.name;
            
            const adminBtn = document.querySelector('[data-view="admin"]');
            if (adminBtn) {
                adminBtn.style.display = this.currentUser.role === 'admin' ? 'inline-block' : 'none';
            }
        }
    }

    logout() {
        this.currentUser = null;
        localStorage.removeItem('soveshaika_user');
        this.showAuthView();
        showNotification('Вы вышли из системы', 'info');
    }

    updateProfile() {
        console.log("👤 Обновление профиля...");
        
        if (!this.currentUser) {
            console.error('❌ Нет текущего пользователя');
            this.showNotification('Пользователь не авторизован', 'error');
            return;
        }
        
        console.log('📊 Текущий пользователь:', this.currentUser);
        
        // Обновляем информацию о текущем пользователе
        const displayName = document.getElementById('displayName');
        const displayEmail = document.getElementById('displayEmail');
        const displayRole = document.getElementById('displayRole');
        
        if (displayName) {
            displayName.textContent = this.currentUser.name || `${this.currentUser.firstName} ${this.currentUser.lastName}`;
            console.log('✅ Имя установлено:', displayName.textContent);
        }
        
        if (displayEmail) {
            displayEmail.textContent = this.currentUser.email || '';
            console.log('✅ Email установлен:', displayEmail.textContent);
        }
        
        if (displayRole) {
            displayRole.textContent = this.getRoleLabel(this.currentUser.role) || 'Пользователь';
            console.log('✅ Роль установлена:', displayRole.textContent);
        }
        
        // Рендерим список пользователей
        this.renderProfileUsers();
    }

    renderProfileUsers() {
        const container = document.getElementById('usersList');
        if (!container) {
            console.error('❌ Элемент usersList не найден');
            return;
        }
        
        if (!this.users || this.users.length === 0) {
            console.log('📝 Пользователи не загружены, загружаем...');
            this.loadAuthUsers().then(() => {
                this.renderProfileUsers(); // Повторно вызываем после загрузки
            });
            return;
        }
        
        console.log(`👥 Отрисовка ${this.users.length} пользователей для профиля`);
        container.innerHTML = '';
        
        this.users.forEach(user => {
            const isCurrent = this.currentUser && user.id === this.currentUser.id;
            const userName = user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim();
            
            const userElement = document.createElement('div');
            userElement.className = `user-item ${isCurrent ? 'active' : ''}`;
            userElement.innerHTML = `
                <div class="user-item-info">
                    <div class="user-item-name">${userName}</div>
                    <div class="user-item-email">${user.email || ''}</div>
                    <div class="user-item-role">${this.getRoleLabel(user.role)}</div>
                </div>
                ${!isCurrent ? `
                    <button class="btn btn-primary btn-small switch-user-btn" data-user-id="${user.id}">
                        Выбрать
                    </button>
                ` : `
                    <span class="current-badge">Текущий</span>
                `}
            `;
            container.appendChild(userElement);
        });
        
        // Добавляем обработчики для кнопок выбора пользователя
        container.querySelectorAll('.switch-user-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const userId = e.target.dataset.userId;
                this.switchUser(userId);
            });
        });
    }

    switchAuthMode(mode) {
        document.getElementById('loginForm').classList.toggle('active', mode === 'login');
        document.getElementById('registerForm').classList.toggle('active', mode === 'register');
        
        // При переключении на логин показываем список пользователей по умолчанию
        if (mode === 'login') {
            this.switchLoginMode('list');
        }
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

    async passwordLogin() {
        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value.trim();

        if (!email || !password) {
            this.showNotification('Заполните email и пароль', 'error');
            return;
        }

        const result = await loginWithPassword(email, password);
        if (result.success) {
            this.currentUser = result.user;
            this.updateUserDisplay();
            document.getElementById('loginEmail').value = '';
            document.getElementById('loginPassword').value = '';
            
            await this.loadRooms();
            this.switchView('home');
            this.showNotification(`Вход выполнен как ${result.user.name}`, 'success');
        } else {
            this.showNotification(result.message, 'error');
        }
    }

    async registerUser() {
        const firstName = document.getElementById('registerFirstName').value.trim();
        const lastName = document.getElementById('registerLastName').value.trim();
        const email = document.getElementById('registerEmail').value.trim();
        const password = document.getElementById('registerPassword').value.trim();

        if (!firstName || !lastName || !email || !password) {
            this.showNotification('Заполните все поля', 'error');
            return;
        }

        if (!email.includes('@')) {
            this.showNotification('Введите корректный email', 'error');
            return;
        }

        if (password.length < 4) {
            this.showNotification('Пароль должен содержать минимум 4 символа', 'error');
            return;
        }

        const result = await createUser(firstName, lastName, email, password);
        if (result.success) {
            this.currentUser = result.user;
            this.updateUserDisplay();
            
            // Очищаем форму
            document.getElementById('registerFirstName').value = '';
            document.getElementById('registerLastName').value = '';
            document.getElementById('registerEmail').value = '';
            document.getElementById('registerPassword').value = '';
            
            // Переключаемся на домашнюю страницу
            await this.loadRooms();
            this.switchView('home');
            this.showNotification(`Добро пожаловать, ${firstName}!`, 'success');
        } else {
            this.showNotification(result.message, 'error');
        }
    }
    
    updateUI() {
        if (this.currentUser) {
            // Обновляем имя пользователя
            const userNameElement = document.querySelector('.user-name');
            if (userNameElement) {
                userNameElement.textContent = this.currentUser.name;
            }

            // Показываем/скрываем кнопку администратора
            const adminBtn = document.querySelector('[data-view="admin"]');
            if (adminBtn) {
                if (this.currentUser.role === 'admin') {
                    adminBtn.style.display = 'inline-block';
                } else {
                    adminBtn.style.display = 'none';
                }
            }

            // Обновляем профиль
            if (document.getElementById('displayName')) {
                document.getElementById('displayName').textContent = this.currentUser.name;
                document.getElementById('displayEmail').textContent = this.currentUser.email;
                document.getElementById('displayRole').textContent = this.getRoleLabel(this.currentUser.role);
            }
        }
    }

    updateAdminPanel() {
        console.log("🛠 Инициализация админ-панели");
        
        // Загружаем данные для админки
        this.loadRoomsForAdmin();
        this.loadAccessList();
        this.loadAllBookings();
        
        // Устанавливаем активную вкладку "Комнаты"
        this.switchTab('rooms');
    }

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
                        this.loadRoomsForAdmin();
                        break;
                    case 'access':
                        this.loadAccessList();
                        break;
                    case 'bookings':
                        this.loadAllBookings();
                        break;
                }
            }
        });
    }
}

window.app = new SoveshaikaApp();
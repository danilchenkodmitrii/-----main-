Проект "Совещайка" - Система бронирования переговорных комнат - Инструкция по установке.
Быстрый старт
1) Предварительные требования:
Python 3.9+
pip (менеджер пакетов Python)
2. Установка зависимостей:
# Клонируйте репозиторий (если нужно)
# git clone <ваш-репозиторий>

# Перейдите в директорию проекта
cd soveshaika

# Установите зависимости
pip install -r requirements.txt

3. Настройка базы данных:
# Инициализация базы данных (таблицы создадутся автоматически при первом запуске)
python main.py
4. Запуск приложения:
# Способ 1: Запуск через uvicorn
python main.py / uvicorn main:app

5. Доступ к приложению:
Приложение: http://localhost:8000

Документация API (Swagger): http://localhost:8000/docs

Документация API (ReDoc): http://localhost:8000/redoc

Health check: http://localhost:8000/health

6. Конфигурация:
Файл .env (опционально)
Создайте файл .env в корневой директории:
DATABASE_URL=sqlite+aiosqlite:///./database/soveshchayka.db
APP_NAME=Совещайка
DEBUG=True
PORT=8000

7. Структура базы данных:
База данных автоматически создается в папке database/:

soveshaika/
├── database/
│   └── soveshchayka.db (автоматически создается)

8. Демо-пользователи:
После инициализации БД создаются 3 пользователя:

Роль	        Email	            Пароль
Администратор	alex@company.com	password123
Менеджер	    maria@company.com	password123
Пользователь	ivan@company.com	password123

9. Основные возможности
Для всех пользователей:
Регистрация и вход

Просмотр списка комнат

Фильтрация комнат (статус, вместимость, оборудование)

Бронирование комнат

Просмотр своих бронирований

Отмена своих бронирований

Для менеджера:
Просмотр всех бронирований

Отмена любых бронирований

Для администратора:
Управление комнатами (добавление/удаление)

Управление ролями пользователей

Все возможности менеджера

10. API Endpoints
Основные:
GET /api/users/ - список пользователей

POST /api/users/login - вход

POST /api/users/register - регистрация

GET /api/rooms/ - список комнат

POST /api/rooms/ - создание комнаты

GET /api/bookings/ - бронирования

POST /api/bookings/ - создание бронирования

DELETE /api/bookings/{id} - отмена бронирования

Админские:
GET /api/admin/users - все пользователи

PUT /api/admin/users/{id}/role - изменение роли

Debug:
GET /api/debug/users - отладка пользователей

GET /api/debug/passwords - проверка паролей

POST /api/debug/fix-passwords - исправление паролей

POST /api/debug/reset-demo-data - сброс демо-данных

11. Создание миграций
# Генерация новой миграции
alembic revision --autogenerate -m "Описание изменений"

# Применение миграций
alembic upgrade head

12. Проверка здоровья
http://localhost:8000/health
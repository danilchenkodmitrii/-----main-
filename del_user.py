import sqlite3

# Подключитесь к базе
conn = sqlite3.connect('database/soveshchayka.db')
cursor = conn.cursor()

# Проверьте
cursor.execute("SELECT * FROM users WHERE id = ?", ('user_b63c11a9',))
user = cursor.fetchone()
print(f"Найден пользователь: {user}")

# Удалите
cursor.execute("DELETE FROM users WHERE id = ?", ('user_b63c11a9',))
cursor.execute("DELETE FROM bookings WHERE user_id = ?", ('user_b63c11a9',))

# Сохраните изменения
conn.commit()
print("✅ Пользователь удален")

# Закройте соединение
conn.close()
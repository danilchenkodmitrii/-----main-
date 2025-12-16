import asyncio
import os
import sys
from pathlib import Path

# Добавляем путь к проекту
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

async def reset_database():
    print("=" * 50)
    print("🔄 ПОЛНЫЙ СБРОС БАЗЫ ДАННЫХ")
    print("=" * 50)
    
    # Удаляем файл БД если существует
    db_path = project_root / "soveshaika.db"
    if db_path.exists():
        print(f"🗑 Удаляем старую базу данных: {db_path}")
        try:
            os.remove(db_path)
            print("✅ Файл БД удален")
        except Exception as e:
            print(f"❌ Ошибка удаления: {e}")
    
    # Импортируем после удаления
    from app.models import init_db, async_session
    from app.models import User, Role, Room, Booking
    from sqlalchemy import select
    
    print("🔄 Создаем новую базу данных...")
    try:
        # Инициализируем БД
        await init_db()
        print("✅ База данных создана")
        
        # Проверяем содержимое
        async with async_session() as session:
            # Проверяем роли
            roles_result = await session.execute(select(Role))
            roles = roles_result.scalars().all()
            print(f"👥 Ролей в БД: {len(roles)}")
            for role in roles:
                print(f"  - {role.name}: {role.description}")
            
            # Проверяем пользователей
            users_result = await session.execute(select(User))
            users = users_result.scalars().all()
            print(f"👤 Пользователей в БД: {len(users)}")
            for user in users:
                print(f"  - {user.first_name} {user.last_name} ({user.email})")
                print(f"    ID: {user.id}, Роль: {user.role_id}")
            
            # Проверяем комнаты
            rooms_result = await session.execute(select(Room))
            rooms = rooms_result.scalars().all()
            print(f"🏢 Комнат в БД: {len(rooms)}")
            for room in rooms:
                print(f"  - {room.name} (вместимость: {room.capacity}, цена: {room.price})")
            
            # Проверяем бронирования
            bookings_result = await session.execute(select(Booking))
            bookings = bookings_result.scalars().all()
            print(f"📅 Бронирований в БД: {len(bookings)}")
            for booking in bookings:
                print(f"  - {booking.title} ({booking.date} {booking.start_time}-{booking.end_time})")
        
        print("=" * 50)
        print("✅ БАЗА ДАННЫХ УСПЕШНО ПЕРЕСОЗДАНА И ПРОВЕРЕНА")
        print("=" * 50)
        
    except Exception as e:
        print(f"❌ Ошибка при создании БД: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(reset_database())
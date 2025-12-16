# debug_booking_fixed.py
import asyncio
import sys
from pathlib import Path

project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

async def debug_booking_error():
    print("🔍 Диагностика ошибки 500 при бронировании")
    print("=" * 60)
    
    from app.models import async_session, User, Room, Booking, engine
    from sqlalchemy import select, text
    from datetime import date, datetime
    
    async with async_session() as session:
        try:
            # 1. Проверяем таблицы через run_sync
            print("\n1. 📊 Проверка таблиц в БД:")
            
            async with engine.connect() as conn:
                result = await conn.execute(text("SELECT name FROM sqlite_master WHERE type='table'"))
                tables = [row[0] for row in result.fetchall()]
                print(f"   Таблицы: {tables}")
            
            # 2. Проверяем пользователей
            print("\n2. 👤 Проверка пользователей:")
            users_result = await session.execute(select(User))
            users = users_result.scalars().all()
            print(f"   Всего пользователей: {len(users)}")
            for user in users[:3]:
                print(f"   - {user.email} (ID: {user.id}, Имя: {user.first_name} {user.last_name})")
            
            # 3. Проверяем комнаты
            print("\n3. 🏢 Проверка комнат:")
            rooms_result = await session.execute(select(Room))
            rooms = rooms_result.scalars().all()
            print(f"   Всего комнат: {len(rooms)}")
            for room in rooms[:3]:
                print(f"   - {room.name} (ID: {room.id}, Вместимость: {room.capacity})")
            
            if not users or not rooms:
                print("❌ Нет пользователей или комнат для теста")
                return
            
            # 4. Пробуем создать бронирование напрямую
            print("\n4. 📝 Тест создания бронирования напрямую:")
            
            test_user = users[0]
            test_room = rooms[0]
            tomorrow = datetime.now().date()
            
            print(f"   Тестовый пользователь: {test_user.email} (ID: {test_user.id})")
            print(f"   Тестовая комната: {test_room.name} (ID: {test_room.id})")
            print(f"   Дата: {tomorrow}")
            
            # Создаем бронирование вручную
            import uuid
            test_booking = Booking(
                id=f"test_{uuid.uuid4().hex[:8]}",
                room_id=test_room.id,
                user_id=test_user.id,
                date=tomorrow,
                start_time="10:00",
                end_time="11:00",
                title="Тестовое бронирование (диагностика)",
                participants="test@example.com"
            )
            
            session.add(test_booking)
            await session.commit()
            await session.refresh(test_booking)
            
            print(f"   ✅ Бронирование создано успешно!")
            print(f"   ID: {test_booking.id}")
            
            # 5. Проверяем, что метод to_dict работает
            print("\n5. 📋 Проверка метода to_dict():")
            try:
                # Явно загружаем связи
                await session.refresh(test_booking, ['user', 'room'])
                
                booking_dict = test_booking.to_dict()
                print(f"   ✅ to_dict() работает")
                print(f"   Данные:")
                print(f"     - ID: {booking_dict.get('id')}")
                print(f"     - Title: {booking_dict.get('title')}")
                print(f"     - Date: {booking_dict.get('date')}")
                print(f"     - User: {booking_dict.get('userName')}")
                print(f"     - Room: {test_room.name}")
            except Exception as e:
                print(f"   ❌ Ошибка в to_dict(): {e}")
                import traceback
                traceback.print_exc()
            
            # 6. Удаляем тестовое бронирование
            await session.delete(test_booking)
            await session.commit()
            print(f"\n   🧹 Тестовое бронирование удалено")
            
        except Exception as e:
            print(f"\n❌ ОШИБКА: {e}")
            import traceback
            print("\n🔍 Полный traceback:")
            traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(debug_booking_error())
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import datetime, timedelta
import bcrypt
from ..models import async_session

from .database import engine
from .role import Role
from .user import User
from .room import Room
from .booking import Booking

async def init_db():
    print("🔄 Создание таблиц...")
    try:
        async with engine.begin() as conn:
            # Создаем все таблицы
            from .base import Base
            await conn.run_sync(Base.metadata.create_all)
        print("✅ Таблицы созданы успешно")
        
        # Инициализируем роли и данные
        await init_roles()
        await init_default_data()
        
    except Exception as e:
        print(f"❌ Ошибка при создании таблиц: {e}")
        import traceback
        traceback.print_exc()
        raise

async def init_roles():
    print("👥 Инициализация ролей...")
    async with async_session() as session:
        try:
            roles_to_create = [
                {"name": "user", "description": "Обычный пользователь"},
                {"name": "manager", "description": "Менеджер"},
                {"name": "admin", "description": "Администратор"}
            ]
            
            for role_data in roles_to_create:
                existing = await session.execute(
                    select(Role).where(Role.name == role_data["name"])
                )
                if not existing.scalar():
                    role = Role(
                        name=role_data["name"],
                        description=role_data["description"]
                    )
                    session.add(role)
                    print(f"  ✅ Создана роль: {role_data['name']}")
            
            await session.commit()
            print("✅ Роли инициализированы")
            
        except Exception as e:
            print(f"❌ Ошибка при создании ролей: {e}")
            await session.rollback()
            raise

async def init_default_data():
    print("📦 Инициализация демо-данных...")
    async with async_session() as session:
        try:
            # Проверяем пользователей
            user_check = await session.execute(select(func.count(User.id)))
            if user_check.scalar() == 0:
                print("👤 Создаем демо-пользователей...")
                
                # Получаем роли
                admin_role = await session.execute(select(Role).where(Role.name == "admin"))
                admin_role = admin_role.scalar()
                user_role = await session.execute(select(Role).where(Role.name == "user"))
                user_role = user_role.scalar()
                
                if not admin_role or not user_role:
                    print("❌ Роли не найдены, создаем заново...")
                    await init_roles()
                    admin_role = await session.execute(select(Role).where(Role.name == "admin"))
                    admin_role = admin_role.scalar()
                    user_role = await session.execute(select(Role).where(Role.name == "user"))
                    user_role = user_role.scalar()

                def hash_pass(password):
                    salt = bcrypt.gensalt()
                    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
                    return hashed.decode('utf-8')
                
                hashed_password = hash_pass("password123")
                
                users = [
                    User(
                        id="admin_001",
                        first_name="Алексей", 
                        last_name="Иванов", 
                        email="alex@company.com", 
                        password=hashed_password, 
                        role_id=admin_role.id
                    ),
                    User(
                        id="user_001",
                        first_name="Мария", 
                        last_name="Петрова", 
                        email="maria@company.com", 
                        password=hashed_password, 
                        role_id=user_role.id
                    ),
                    User(
                        id="user_002", 
                        first_name="Иван", 
                        last_name="Сидоров", 
                        email="ivan@company.com", 
                        password=hashed_password, 
                        role_id=user_role.id
                    )
                ]
                session.add_all(users)
                await session.commit()
                print(f"✅ Создано {len(users)} пользователей")

            # Проверяем комнаты
            room_check = await session.execute(select(func.count(Room.id)))
            if room_check.scalar() == 0:
                print("🏢 Создаем демо-комнаты...")
                rooms = [
                    Room(
                        id="room_001", 
                        name='Переговорная "Альфа"', 
                        capacity=6, 
                        amenities="Видеоконференция, Smart board, Wi-Fi", 
                        price=500.0
                    ),
                    Room(
                        id="room_002", 
                        name='Переговорная "Бета"', 
                        capacity=4, 
                        amenities="Проектор, флипчарт, телевизор", 
                        price=350.0
                    ),
                    Room(
                        id="room_003", 
                        name='Переговорная "Гамма"', 
                        capacity=10, 
                        amenities="Видеоконференция, 4K экран, микрофонная система", 
                        price=800.0
                    ),
                    Room(
                        id="room_004", 
                        name='Переговорная "Дельта"', 
                        capacity=2, 
                        amenities="Звукоизоляция, кондиционер", 
                        price=250.0
                    )
                ]
                session.add_all(rooms)
                await session.commit()
                print(f"✅ Создано {len(rooms)} комнат")

            # Проверяем бронирования
            booking_check = await session.execute(select(func.count(Booking.id)))
            if booking_check.scalar() == 0:
                print("📅 Создаем демо-бронирования...")
                today = datetime.now().date()
                tomorrow = today + timedelta(days=1)
                
                bookings = [
                    Booking(
                        id="book_001",
                        room_id="room_001",
                        user_id="user_001",
                        date=today,
                        start_time="09:00",
                        end_time="10:00",
                        title="Планерка отдела",
                        participants=""
                    ),
                    Booking(
                        id="book_002",
                        room_id="room_001", 
                        user_id="user_002",
                        date=today,
                        start_time="11:00",
                        end_time="12:30",
                        title="Презентация проекта",
                        participants="alex@company.com, manager@company.com"
                    ),
                    Booking(
                        id="book_003",
                        room_id="room_002",
                        user_id="admin_001",
                        date=tomorrow,
                        start_time="14:00",
                        end_time="15:30",
                        title="Совещание с клиентом",
                        participants="client@company.com"
                    )
                ]
                session.add_all(bookings)
                await session.commit()
                print(f"✅ Создано {len(bookings)} бронирований")
            
            print("✅ Демо-данные успешно инициализированы")
            
        except Exception as e:
            print(f"❌ Ошибка при создании демо-данных: {e}")
            await session.rollback()
            raise
from sqlalchemy import Column, String, Integer, Text, Float, Date, DateTime, ForeignKey, func, select, and_, or_
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import declarative_base, relationship, sessionmaker
from datetime import datetime
import os
from pathlib import Path
import bcrypt
# Получаем корневую директорию проекта
BASE_DIR = Path(__file__).parent.parent.parent  # Поднимаемся на 3 уровня из app/models/

# Создаем папку для базы данных, если её нет
DB_DIR = BASE_DIR / "database"
DB_DIR.mkdir(exist_ok=True)
async def init_default_data():
    async with async_session() as session:
        from sqlalchemy import select
        from sqlalchemy.sql import func
        import bcrypt  # добавьте этот импорт
        
        user_check = await session.execute(select(func.count(User.id)))
        if user_check.scalar() == 0:
            admin_role = await session.execute(select(Role).where(Role.name == "admin"))
            admin_role = admin_role.scalar()
            user_role = await session.execute(select(Role).where(Role.name == "user"))
            user_role = user_role.scalar()

            # Хешируем пароли для демо-пользователей
            def hash_pass(password):
                salt = bcrypt.gensalt()
                hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
                return hashed.decode('utf-8')
            
            hashed_password = hash_pass("password123")
            
            users = [
                User(id="user_1", first_name="Алексей", last_name="Иванов", 
                     email="alex@company.com", password=hashed_password, role_id=admin_role.id),
                User(id="user_2", first_name="Мария", last_name="Петрова", 
                     email="maria@company.com", password=hashed_password, role_id=user_role.id),
                User(id="user_3", first_name="Иван", last_name="Сидоров", 
                     email="ivan@company.com", password=hashed_password, role_id=user_role.id)
            ]
            session.add_all(users)
            await session.commit()


Base = declarative_base()

class Role(Base):
    __tablename__ = "role"

    id = Column(Integer, primary_key=True)
    name = Column(String(50), unique=True, nullable=False)
    description = Column(String(255))
    users = relationship("User", back_populates="role")

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description
        }

class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    email = Column(String(120), unique=True, nullable=False)
    password = Column(String(255), nullable=False)
    role_id = Column(Integer, ForeignKey("role.id"), default=1)
    role = relationship("Role", back_populates="users")
    created_at = Column(DateTime, default=datetime.utcnow)
    bookings = relationship("Booking", back_populates="user", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "name": f"{self.first_name} {self.last_name}",
            "firstName": self.first_name,
            "lastName": self.last_name,
            "email": self.email,
            "role": self.role.name if self.role else "user",
            "createdAt": self.created_at.isoformat()
        }

class Room(Base):
    __tablename__ = "rooms"

    id = Column(String(36), primary_key=True)
    name = Column(String(255), nullable=False)
    capacity = Column(Integer, nullable=False)
    amenities = Column(Text)
    price = Column(Float, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    bookings = relationship("Booking", back_populates="room", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "capacity": self.capacity,
            "amenities": self.amenities or "",
            "price": self.price,
            "createdAt": self.created_at.isoformat()
        }

class Booking(Base):
    __tablename__ = "bookings"

    id = Column(String(36), primary_key=True)
    room_id = Column(String(36), ForeignKey("rooms.id"), nullable=False)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    date = Column(Date, nullable=False)
    start_time = Column(String(5), nullable=False)
    end_time = Column(String(5), nullable=False)
    title = Column(String(255), nullable=False)
    participants = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    user = relationship("User", back_populates="bookings")
    room = relationship("Room", back_populates="bookings")

    def to_dict(self):
        participants = []
        if self.participants:
            participants = [p.strip() for p in self.participants.split(",")]

        return {
            "id": self.id,
            "roomId": self.room_id,
            "userId": self.user_id,
            "userName": self.user.first_name + " " + self.user.last_name if self.user else "",
            "date": self.date.isoformat() if self.date else "",
            "startTime": self.start_time,
            "endTime": self.end_time,
            "title": self.title,
            "participants": participants,
            "createdAt": self.created_at.isoformat() if self.created_at else ""
        }

DATABASE_URL = f"sqlite+aiosqlite:///{DB_DIR}/soveshchayka.db"
engine = create_async_engine(DATABASE_URL, echo=False)
async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

async def get_db():
    async with async_session() as session:
        yield session

async def init_db():
    print("🔄 Создание таблиц...")
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        print("✅ Таблицы созданы успешно")
        
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
        from sqlalchemy import select
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
        from sqlalchemy import select
        from sqlalchemy.sql import func
        from datetime import datetime, timedelta

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
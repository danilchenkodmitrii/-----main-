from fastapi import APIRouter, HTTPException
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import async_session, User, Room, Booking, Role
import bcrypt

debug_router = APIRouter()

@debug_router.get("/users")
async def debug_users():
    """Отладочный endpoint для проверки пользователей"""
    async with async_session() as session:
        try:
            # Проверяем таблицы
            result = await session.execute(text("SELECT name FROM sqlite_master WHERE type='table'"))
            tables = result.fetchall()
            
            # Проверяем пользователей
            users_result = await session.execute(select(User))
            users = users_result.scalars().all()
            
            # Проверяем роли
            roles_result = await session.execute(select(Role))
            roles = roles_result.scalars().all()
            
            return {
                "tables": [t[0] for t in tables],
                "users_count": len(users),
                "users": [
                    {
                        "id": u.id,
                        "name": f"{u.first_name} {u.last_name}",
                        "email": u.email,
                        "password_length": len(u.password) if u.password else 0,
                        "password_preview": u.password[:30] + "..." if u.password else "none",
                        "role_id": u.role_id
                    } for u in users
                ],
                "roles": [{"id": r.id, "name": r.name} for r in roles]
            }
        except Exception as e:
            return {"error": str(e)}

@debug_router.get("/rooms")
async def debug_rooms():
    """Отладочный endpoint для проверки комнат"""
    async with async_session() as session:
        try:
            result = await session.execute(select(Room))
            rooms = result.scalars().all()
            
            return {
                "rooms_count": len(rooms),
                "rooms": [
                    {
                        "id": r.id,
                        "name": r.name,
                        "capacity": r.capacity,
                        "price": r.price,
                        "amenities": r.amenities,
                        "created_at": r.created_at.isoformat() if r.created_at else None
                    } for r in rooms
                ]
            }
        except Exception as e:
            return {"error": str(e)}

@debug_router.get("/bookings")
async def debug_bookings():
    """Отладочный endpoint для проверки бронирований"""
    async with async_session() as session:
        try:
            result = await session.execute(select(Booking))
            bookings = result.scalars().all()
            
            return {
                "bookings_count": len(bookings),
                "bookings": [
                    {
                        "id": b.id,
                        "room_id": b.room_id,
                        "user_id": b.user_id,
                        "date": b.date.isoformat() if b.date else None,
                        "start_time": b.start_time,
                        "end_time": b.end_time,
                        "title": b.title,
                        "participants": b.participants,
                        "created_at": b.created_at.isoformat() if b.created_at else None
                    } for b in bookings
                ]
            }
        except Exception as e:
            return {"error": str(e)}

@debug_router.get("/passwords")
async def debug_passwords():
    """Отладочный endpoint для проверки паролей"""
    async with async_session() as session:
        try:
            result = await session.execute(select(User))
            users = result.scalars().all()
            
            debug_info = []
            for user in users:
                # Проверяем текущий пароль
                password_correct = False
                password_type = "unknown"
                
                if user.password:
                    # Пробуем проверить как bcrypt хеш
                    try:
                        if bcrypt.checkpw(b"password123", user.password.encode('utf-8')):
                            password_correct = True
                            password_type = "bcrypt"
                    except:
                        pass
                    
                    # Пробуем как plain text
                    if user.password == "password123":
                        password_correct = True
                        password_type = "plain"
                    
                    # Пробуем как хешированный пароль
                    if user.password.startswith("$2b$"):
                        password_type = "bcrypt_hash"
                
                debug_info.append({
                    "id": user.id,
                    "name": f"{user.first_name} {user.last_name}",
                    "email": user.email,
                    "password_exists": bool(user.password),
                    "password_length": len(user.password) if user.password else 0,
                    "password_preview": user.password[:20] + "..." if user.password else "none",
                    "password_type": password_type,
                    "password_correct_for_'password123'": password_correct
                })
            
            return {
                "users": debug_info
            }
        except Exception as e:
            return {"error": str(e)}

@debug_router.post("/fix-passwords")
async def fix_passwords():
    """Исправление паролей (хеширование plain text паролей)"""
    async with async_session() as session:
        try:
            result = await session.execute(select(User))
            users = result.scalars().all()
            
            fixed_count = 0
            for user in users:
                if user.password and not user.password.startswith("$2b$"):
                    # Хешируем пароль
                    hashed = bcrypt.hashpw(
                        user.password.encode('utf-8'),
                        bcrypt.gensalt()
                    ).decode('utf-8')
                    
                    user.password = hashed
                    fixed_count += 1
            
            if fixed_count > 0:
                await session.commit()
                return {
                    "message": f"Исправлено {fixed_count} паролей",
                    "fixed_count": fixed_count
                }
            else:
                return {
                    "message": "Все пароли уже хешированы",
                    "fixed_count": 0
                }
                
        except Exception as e:
            await session.rollback()
            return {"error": str(e)}

@debug_router.post("/reset-demo-data")
async def reset_demo_data():
    """Сброс демо-данных к начальному состоянию"""
    async with async_session() as session:
        try:
            # Удаляем все данные (осторожно!)
            await session.execute(text("DELETE FROM bookings"))
            await session.execute(text("DELETE FROM users"))
            await session.execute(text("DELETE FROM rooms"))
            await session.execute(text("DELETE FROM role"))
            
            # Сбрасываем автоинкремент для SQLite
            await session.execute(text("DELETE FROM sqlite_sequence"))
            
            await session.commit()
            
            # Импортируем функцию инициализации
            from app.models import init_db
            await init_db()
            
            return {
                "message": "Демо-данные сброшены",
                "status": "success"
            }
            
        except Exception as e:
            await session.rollback()
            return {"error": str(e), "status": "error"}

@debug_router.get("/health")
async def health_check():
    """Проверка здоровья API"""
    return {
        "status": "healthy",
        "service": "soveshaika",
        "version": "1.0.0",
        "timestamp": "2024-01-15T12:00:00Z"
    }

@debug_router.get("/database-info")
async def database_info():
    """Информация о базе данных"""
    async with async_session() as session:
        try:
            # Получаем информацию о таблицах
            result = await session.execute(
                text("SELECT name, sql FROM sqlite_master WHERE type='table'")
            )
            tables = result.fetchall()
            
            # Получаем размер базы данных
            import os
            from pathlib import Path
            
            BASE_DIR = Path(__file__).parent.parent.parent
            db_path = BASE_DIR / "database" / "soveshchayka.db"
            
            db_size = 0
            if db_path.exists():
                db_size = os.path.getsize(db_path)
            
            return {
                "database_path": str(db_path),
                "database_size_bytes": db_size,
                "database_size_mb": round(db_size / (1024 * 1024), 2),
                "tables": [
                    {
                        "name": table[0],
                        "schema": table[1][:100] + "..." if table[1] and len(table[1]) > 100 else table[1]
                    } for table in tables
                ]
            }
        except Exception as e:
            return {"error": str(e)}
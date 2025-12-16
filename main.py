import logging
from fastapi import FastAPI, Request, Depends
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from contextlib import asynccontextmanager
import uvicorn
from pathlib import Path
import mimetypes
from dotenv import load_dotenv
import os

# Импортируем из папки app
from app.exceptions.user_exceptions import UserNotFound, UserAlreadyExists, InvalidUserData
from app.exceptions.room_exceptions import RoomNotFound, InvalidRoomData
from app.exceptions.booking_exceptions import BookingNotFound, TimeSlotNotAvailable, InvalidBookingData
from app.exceptions.role_exceptions import RoleNotFound, InvalidRoleData

# Импортируем роутеры из app
from app.api import users_router, rooms_router, bookings_router, admin_router, roles_router
from app.models import init_db

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./database/soveshchayka.db")
APP_NAME = os.getenv("APP_NAME", "Совещайка")
DEBUG = os.getenv("DEBUG", "True").lower() == "true"
PORT = int(os.getenv("PORT", "8000"))

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("🚀 Инициализация базы данных...")
    try:
        await init_db()
        print("✅ База данных инициализирована")
    except Exception as e:
        print(f"❌ Ошибка инициализации БД: {e}")
        import traceback
        traceback.print_exc()
    yield
    print("🛑 Приложение завершает работу...")

app = FastAPI(
    title="Совещайка - Система бронирования переговорных комнат",
    description="Система для бронирования переговорных комнат",
    version="1.0.0",
    lifespan=lifespan
)

# Настройка CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Настройка статических файлов и шаблонов
BASE_DIR = Path(__file__).parent
APP_DIR = BASE_DIR / "app"

mimetypes.init()
mimetypes.add_type('application/javascript', '.js')
mimetypes.add_type('text/css', '.css')

# Подключение статических файлов
app.mount("/static", StaticFiles(directory=APP_DIR / "static"), name="static")
app.mount("/static", StaticFiles(directory=APP_DIR / "static"), name="static")
app.mount("/icons", StaticFiles(directory=APP_DIR / "icons"), name="icons")

# Настройка шаблонов
templates = Jinja2Templates(directory=APP_DIR / "templates")

# Подключение API роутеров
app.include_router(users_router, prefix="/api/users", tags=["Users"])
app.include_router(rooms_router, prefix="/api/rooms", tags=["Rooms"])
app.include_router(bookings_router, prefix="/api/bookings", tags=["Bookings"])
app.include_router(admin_router, prefix="/api/admin", tags=["Admin"])
app.include_router(roles_router, prefix="/api/roles", tags=["Roles"])

# Обработчики исключений
@app.exception_handler(UserNotFound)
@app.exception_handler(RoomNotFound)
@app.exception_handler(BookingNotFound)
@app.exception_handler(RoleNotFound)
async def not_found_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=404,
        content={"detail": str(exc)},
    )

@app.exception_handler(UserAlreadyExists)
@app.exception_handler(TimeSlotNotAvailable)
@app.exception_handler(InvalidUserData)
@app.exception_handler(InvalidRoomData)
@app.exception_handler(InvalidBookingData)
@app.exception_handler(InvalidRoleData)
async def bad_request_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=400,
        content={"detail": str(exc)},
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors()},
    )

@app.get("/debug/users")
async def debug_users():
    from app.models import async_session, User, Role
    from sqlalchemy import select
    
    async with async_session() as session:
        try:
            # Проверяем таблицы
            from sqlalchemy import text
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
                        "role_id": u.role_id
                    } for u in users
                ],
                "roles": [{"id": r.id, "name": r.name} for r in roles]
            }
        except Exception as e:
            return {"error": str(e)}
        
@app.get("/debug/rooms")
async def debug_rooms():
    from app.models import async_session, Room
    from sqlalchemy import select
    
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
                        "amenities": r.amenities
                    } for r in rooms
                ]
            }
        except Exception as e:
            return {"error": str(e)}

@app.get("/debug/passwords")
async def debug_passwords():
    from app.models import async_session, User
    from sqlalchemy import select
    import bcrypt
    
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

# Главная страница
@app.get("/", response_class=HTMLResponse)
async def read_root(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

# Здоровье приложения
@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "soveshaika"}

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
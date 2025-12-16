from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
import traceback

from app.models import get_db
from app.services.user_service import UserService
from app.schemes.user_schema import UserCreateSchema, UserRoleUpdateSchema
from app.exceptions.user_exceptions import UserNotFound, UserAlreadyExists, InvalidUserData

users_router = APIRouter()

@users_router.get("/")
async def get_all_users(db: AsyncSession = Depends(get_db)):
    try:
        print("🔍 Запрос на получение всех пользователей...")
        users = await UserService.get_all_users(db)
        print(f"✅ Найдено {len(users)} пользователей")
        return [user.to_dict() for user in users]
    except Exception as e:
        print(f"❌ Ошибка при получении пользователей: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Server error: {str(e)}")

@users_router.post("/login")
async def login(data: dict, db: AsyncSession = Depends(get_db)):
    try:
        print("🔐 Запрос на вход в систему")
        print(f"📧 Данные для входа: email={data.get('email')}")
        
        email = data.get("email")
        password = data.get("password")
        
        if not email or not password:
            print("❌ Отсутствует email или пароль")
            raise HTTPException(status_code=400, detail="Email and password required")
        
        print(f"🔄 Аутентификация пользователя {email}...")
        
        # Здесь должен вызываться статический метод
        user = await UserService.authenticate_user(db, email, password)
        
        if not user:
            print(f"❌ Неверные учетные данные для {email}")
            raise HTTPException(status_code=401, detail="Invalid credentials")
        
        print(f"✅ Успешный вход для {email}")
        user_dict = user.to_dict()
        print(f"📊 Данные пользователя: {user_dict}")
        return user_dict
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Неожиданная ошибка при входе: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Server error: {str(e)}")

@users_router.get("/{user_id}")
async def get_user(user_id: str, db: AsyncSession = Depends(get_db)):
    try:
        user = await UserService.get_user_by_id(db, user_id)
        return user.to_dict()
    except UserNotFound as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Server error: {str(e)}")

@users_router.post("/register")
async def register(user_data: UserCreateSchema, db: AsyncSession = Depends(get_db)):
    try:
        print("👤 Запрос на регистрацию нового пользователя")
        print(f"📝 Данные: {user_data.firstName} {user_data.lastName}, {user_data.email}")
        
        user = await UserService.create_user(db, user_data)
        
        # Проверяем, что пароль сохранен правильно
        print(f"🔍 Проверка созданного пользователя:")
        print(f"   ID: {user.id}")
        print(f"   Email: {user.email}")
        print(f"   Пароль в БД: {user.password[:30]}..." if user.password else "❌ Пароль отсутствует!")
        
        user_dict = user.to_dict()
        print(f"✅ Пользователь успешно зарегистрирован: {user_dict['name']}")
        
        return user_dict
    except UserAlreadyExists as e:
        print(f"❌ Пользователь уже существует: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except InvalidUserData as e:
        print(f"❌ Неверные данные: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"❌ Ошибка регистрации: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Registration error: {str(e)}")

@users_router.post("/login")
async def login(data: dict, db: AsyncSession = Depends(get_db)):
    try:
        email = data.get("email")
        password = data.get("password")
        
        if not email or not password:
            raise HTTPException(status_code=400, detail="Email and password required")
        
        user = await UserService.authenticate_user(db, email, password)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid credentials")
        
        return user.to_dict()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Server error: {str(e)}")

@users_router.put("/{user_id}/role")
async def update_user_role(user_id: str, role_data: UserRoleUpdateSchema, db: AsyncSession = Depends(get_db)):
    try:
        user = await UserService.update_user_role(db, user_id, role_data.role)
        return user.to_dict()
    except UserNotFound as e:
        raise HTTPException(status_code=404, detail=str(e))
    except InvalidUserData as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Server error: {str(e)}")
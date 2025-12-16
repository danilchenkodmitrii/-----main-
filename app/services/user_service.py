from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
import uuid
import bcrypt

from app.models import User, Role
from app.schemes.user_schema import UserCreateSchema
from app.exceptions.user_exceptions import UserAlreadyExists, UserNotFound, InvalidUserData
from app.repositories.user_repository import UserRepository

class UserService:
    @staticmethod
    def hash_password(password: str) -> str:
        """Хеширование пароля"""
        salt = bcrypt.gensalt()
        hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
        return hashed.decode('utf-8')
    
    @staticmethod
    def verify_password(plain_password: str, hashed_password: str) -> bool:
        """Проверка пароля"""
        try:
            return bcrypt.checkpw(
                plain_password.encode('utf-8'), 
                hashed_password.encode('utf-8')
            )
        except Exception as e:
            print(f"❌ Ошибка проверки пароля: {e}")
            return False
    
    @staticmethod
    async def authenticate_user(session: AsyncSession, email: str, password: str):
        """Аутентификация пользователя с проверкой пароля через bcrypt"""
        print(f"🔐 Аутентификация пользователя: {email}")
        
        try:
            # Ищем пользователя по email
            result = await session.execute(
                select(User).where(User.email == email)
            )
            user = result.scalar()
            
            if not user:
                print(f"❌ Пользователь с email {email} не найден")
                return None
            
            print(f"✅ Найден пользователь: {user.first_name} {user.last_name}")
            
            # Проверяем, что у пользователя есть пароль
            if not user.password:
                print("❌ У пользователя нет пароля в БД")
                return None
            
            # Проверка пароля через bcrypt
            print(f"🔑 Проверка пароля через bcrypt...")
            
            # Проверяем пароль через bcrypt
            is_valid = bcrypt.checkpw(
                password.encode('utf-8'), 
                user.password.encode('utf-8')
            )
            
            if is_valid:
                print("✅ Пароль проверен успешно")
                
                # Загружаем связанные данные роли
                await session.refresh(user, ['role'])
                role_name = user.role.name if user.role else 'user'
                print(f"👤 Роль пользователя: {role_name}")
                
                return user
            else:
                print(f"❌ Неверный пароль для пользователя {email}")
                return None
                
        except Exception as e:
            print(f"❌ Ошибка при аутентификации: {str(e)}")
            import traceback
            traceback.print_exc()
            return None
    
    @staticmethod
    async def get_all_users(session: AsyncSession):
        try:
            print("🔄 Получение всех пользователей из базы...")
            users = await UserRepository.get_all_users(session)
            print(f"✅ Успешно получено {len(users)} пользователей")
            return users
        except Exception as e:
            print(f"❌ Ошибка в UserService.get_all_users: {str(e)}")
            raise
    
    @staticmethod
    async def get_user_by_id(session: AsyncSession, user_id: str):
        user = await UserRepository.get_user_by_id(session, user_id)
        if not user:
            raise UserNotFound(f"User with id {user_id} not found")
        return user
    
    @staticmethod
    async def get_user_by_email(session: AsyncSession, email: str):
        user = await UserRepository.get_user_by_email(session, email)
        if not user:
            raise UserNotFound(f"User with email {email} not found")
        return user
    
    @staticmethod
    async def create_user(session: AsyncSession, user_data: UserCreateSchema):
        """Создание нового пользователя с правильным хешированием пароля"""
        print(f"👤 Регистрация нового пользователя: {user_data.email}")
        
        # Проверяем существование
        existing = await UserRepository.get_user_by_email(session, user_data.email)
        if existing:
            raise UserAlreadyExists(f"User with email {user_data.email} already exists")
        
        # Валидация
        if len(user_data.password) < 4:
            raise InvalidUserData("Password must be at least 4 characters long")
        
        if not user_data.email or "@" not in user_data.email:
            raise InvalidUserData("Invalid email format")
        
        # Получаем роль "user"
        user_role = await session.execute(select(Role).where(Role.name == "user"))
        role = user_role.scalar()
        
        if not role:
            role = Role(name="user", description="Regular user")
            session.add(role)
            await session.commit()
            await session.refresh(role)
        
        # Хешируем пароль ПРАВИЛЬНО
        print(f"🔐 Хеширование пароля...")
        hashed_password = bcrypt.hashpw(
            user_data.password.encode('utf-8'),
            bcrypt.gensalt()
        ).decode('utf-8')
        
        print(f"✅ Пароль хеширован: {hashed_password[:30]}...")
        
        # Создаем пользователя
        new_user = User(
            id=f"user_{uuid.uuid4().hex[:8]}",
            first_name=user_data.firstName,
            last_name=user_data.lastName,
            email=user_data.email,
            password=hashed_password,
            role_id=role.id
        )
        
        session.add(new_user)
        await session.commit()
        await session.refresh(new_user)
        await session.refresh(new_user, ['role'])
        
        print(f"✅ Пользователь успешно создан: {new_user.first_name} {new_user.last_name}")
        
        return new_user
    
    @staticmethod
    async def update_user_role(session: AsyncSession, user_id: str, role_name: str):
        user = await UserService.get_user_by_id(session, user_id)
        
        role_result = await session.execute(select(Role).where(Role.name == role_name))
        role = role_result.scalar()
        if not role:
            raise InvalidUserData(f"Role {role_name} not found")
        
        user.role_id = role.id
        await session.commit()
        await session.refresh(user)
        await session.refresh(user, ['role'])
        return user
    
    @staticmethod
    async def delete_user(session: AsyncSession, user_id: str):
        user = await UserService.get_user_by_id(session, user_id)
        
        await session.delete(user)
        await session.commit()
        return True
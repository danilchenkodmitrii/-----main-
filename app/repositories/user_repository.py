from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional, List

from app.models import User

class UserRepository:
    @staticmethod
    async def get_all_users(session: AsyncSession) -> List[User]:
        try:
            print("📦 Repository: Запрос всех пользователей...")
            result = await session.execute(select(User))
            users = list(result.scalars().all())
            print(f"📦 Repository: Найдено {len(users)} пользователей")
            
            # Загружаем связанные данные ролей
            for user in users:
                await session.refresh(user, ['role'])
                print(f"  - {user.first_name} {user.last_name} ({user.email}) - роль: {user.role.name if user.role else 'нет'}")
            
            return users
        except Exception as e:
            print(f"❌ Repository error: {str(e)}")
            raise
    
    @staticmethod
    async def get_user_by_id(session: AsyncSession, user_id: str) -> Optional[User]:
        user = await session.get(User, user_id)
        if user:
            await session.refresh(user, ['role'])
        return user
    
    @staticmethod
    async def get_user_by_email(session: AsyncSession, email: str) -> Optional[User]:
        result = await session.execute(
            select(User).where(User.email == email)
        )
        user = result.scalar()
        if user:
            await session.refresh(user, ['role'])
        return user
    
    @staticmethod
    async def create_user(session: AsyncSession, user_data: dict) -> User:
        user = User(**user_data)
        session.add(user)
        await session.commit()
        await session.refresh(user)
        return user
    
    @staticmethod
    async def update_user(session: AsyncSession, user_id: str, update_data: dict) -> Optional[User]:
        user = await UserRepository.get_user_by_id(session, user_id)
        if user:
            for key, value in update_data.items():
                setattr(user, key, value)
            await session.commit()
            await session.refresh(user)
        return user
    
    @staticmethod
    async def delete_user(session: AsyncSession, user_id: str) -> bool:
        user = await UserRepository.get_user_by_id(session, user_id)
        if user:
            await session.delete(user)
            await session.commit()
            return True
        return False
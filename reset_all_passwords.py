import asyncio
import bcrypt
import sys
from pathlib import Path

project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

async def reset_all_passwords():
    print("🔐 Сброс всех паролей на 'password123'")
    print("=" * 50)
    
    from app.models import async_session, User
    from sqlalchemy import select
    
    async with async_session() as session:
        try:
            result = await session.execute(select(User))
            users = result.scalars().all()
            
            print(f"👤 Найдено {len(users)} пользователей")
            
            for user in users:
                print(f"\n🔧 Исправляем пароль для: {user.email}")
                
                # Хешируем стандартный пароль
                hashed_password = bcrypt.hashpw(
                    b"password123",
                    bcrypt.gensalt()
                ).decode('utf-8')
                
                user.password = hashed_password
                print(f"   ✅ Новый хеш: {hashed_password[:30]}...")
                
                # Проверяем что работает
                if bcrypt.checkpw(b"password123", hashed_password.encode('utf-8')):
                    print("   ✅ Проверка успешна")
                else:
                    print("   ❌ Проверка не удалась")
            
            # Сохраняем изменения
            await session.commit()
            print(f"\n✅ Все пароли сброшены на 'password123'")
            
            # Тестируем аутентификацию
            print("\n🔍 Тестирование аутентификации...")
            for user in users:
                await session.refresh(user)
                if bcrypt.checkpw(b"password123", user.password.encode('utf-8')):
                    print(f"   ✅ {user.email}: пароль работает")
                else:
                    print(f"   ❌ {user.email}: пароль НЕ работает")
            
        except Exception as e:
            print(f"❌ Ошибка: {e}")
            import traceback
            traceback.print_exc()
            await session.rollback()

if __name__ == "__main__":
    asyncio.run(reset_all_passwords())
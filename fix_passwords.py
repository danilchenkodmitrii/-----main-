import asyncio
import bcrypt
import sys
from pathlib import Path

project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

async def fix_passwords():
    print("🔧 Исправление паролей в базе данных")
    print("=" * 50)
    
    from app.models import async_session, User
    from sqlalchemy import select
    
    async with async_session() as session:
        try:
            result = await session.execute(select(User))
            users = result.scalars().all()
            
            print(f"👤 Найдено {len(users)} пользователей")
            
            fixed_count = 0
            for user in users:
                print(f"\n🔍 Проверяем пользователя: {user.first_name} {user.last_name} ({user.email})")
                
                if not user.password:
                    print("  ❌ Пароль отсутствует")
                    new_password = bcrypt.hashpw("password123".encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
                    user.password = new_password
                    fixed_count += 1
                    print(f"  ✅ Установлен новый пароль (bcrypt хеш)")
                
                elif user.password == "password123":
                    print("  ⚠️ Пароль в plain text")
                    new_password = bcrypt.hashpw(user.password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
                    user.password = new_password
                    fixed_count += 1
                    print(f"  ✅ Конвертирован в bcrypt хеш")
                
                elif not user.password.startswith("$2b$"):
                    print(f"  ⚠️ Неизвестный формат пароля: {user.password[:20]}...")
                    new_password = bcrypt.hashpw("password123".encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
                    user.password = new_password
                    fixed_count += 1
                    print(f"  ✅ Установлен новый bcrypt хеш")
                
                else:
                    print(f"  ✅ Пароль уже в правильном формате (bcrypt)")
            
            if fixed_count > 0:
                await session.commit()
                print(f"\n✅ Исправлено {fixed_count} паролей")
            else:
                print(f"\n✅ Все пароли уже в правильном формате")
            
            # Проверяем что все работает
            print("\n🔍 Проверяем аутентификацию...")
            for user in users:
                await session.refresh(user)
                if bcrypt.checkpw(b"password123", user.password.encode('utf-8')):
                    print(f"  ✅ {user.email}: пароль работает")
                else:
                    print(f"  ❌ {user.email}: пароль НЕ работает")
            
        except Exception as e:
            print(f"❌ Ошибка: {e}")
            import traceback
            traceback.print_exc()
            await session.rollback()

if __name__ == "__main__":
    asyncio.run(fix_passwords())
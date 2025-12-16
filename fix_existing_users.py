import asyncio
import bcrypt
import sys
from pathlib import Path

project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

async def fix_existing_users():
    print("🔧 Исправление паролей существующих пользователей")
    print("=" * 50)
    
    from app.models import async_session, User
    from sqlalchemy import select
    
    async with async_session() as session:
        try:
            result = await session.execute(select(User))
            users = result.scalars().all()
            
            print(f"👤 Найдено {len(users)} пользователей")
            
            for user in users:
                print(f"\n🔍 Проверяем: {user.email}")
                print(f"  Имя: {user.first_name} {user.last_name}")
                print(f"  Текущий пароль: {user.password[:30]}..." if user.password else "Нет пароля")
                
                # Пробуем определить, правильно ли хеширован пароль
                needs_fix = False
                
                if not user.password:
                    print("  ❌ Нет пароля - требуется исправление")
                    needs_fix = True
                    new_password = "password123"  # стандартный пароль
                
                elif user.password == "password123":
                    print("  ⚠️ Пароль в plain text - требуется хеширование")
                    needs_fix = True
                    new_password = "password123"
                
                elif not user.password.startswith("$2b$"):
                    print(f"  ⚠️ Не bcrypt формат - требуется исправление")
                    needs_fix = True
                    new_password = "password123"  # сбрасываем на стандартный
                
                else:
                    # Это bcrypt хеш, проверяем работает ли
                    try:
                        if bcrypt.checkpw(b"password123", user.password.encode('utf-8')):
                            print(f"  ✅ Пароль работает (bcrypt)")
                        else:
                            print(f"  ❌ Пароль не работает с 'password123'")
                            needs_fix = True
                            new_password = "password123"
                    except:
                        print(f"  ❌ Ошибка проверки bcrypt")
                        needs_fix = True
                        new_password = "password123"
                
                if needs_fix:
                    print(f"  🔧 Исправляем пароль...")
                    
                    # Хешируем пароль
                    try:
                        hashed_password = bcrypt.hashpw(
                            new_password.encode('utf-8'), 
                            bcrypt.gensalt()
                        ).decode('utf-8')
                        
                        user.password = hashed_password
                        print(f"  ✅ Новый хеш: {hashed_password[:30]}...")
                        
                        # Проверяем что новый хеш работает
                        if bcrypt.checkpw(new_password.encode('utf-8'), hashed_password.encode('utf-8')):
                            print(f"  ✅ Новый пароль проверен успешно")
                        else:
                            print(f"  ❌ Ошибка: новый пароль не проходит проверку")
                            
                    except Exception as e:
                        print(f"  ❌ Ошибка хеширования: {e}")
                        # Если bcrypt не работает, сохраняем как есть
                        user.password = new_password
                        print(f"  ⚠️ Сохраняем пароль без хеширования")
            
            # Сохраняем изменения
            await session.commit()
            print(f"\n✅ Изменения сохранены")
            
            # Проверяем всех пользователей после исправления
            print(f"\n🔍 Итоговая проверка:")
            await session.refresh()
            
            for user in users:
                await session.refresh(user)
                print(f"\n📋 {user.email}:")
                print(f"  Пароль: {user.password[:30]}...")
                
                if user.password and user.password.startswith("$2b$"):
                    try:
                        # Пробуем стандартный пароль
                        if bcrypt.checkpw(b"password123", user.password.encode('utf-8')):
                            print(f"  ✅ Работает с 'password123'")
                        else:
                            print(f"  ❌ Не работает с 'password123'")
                    except:
                        print(f"  ❌ Ошибка проверки")
                else:
                    print(f"  ⚠️ Не bcrypt формат")
            
        except Exception as e:
            print(f"❌ Ошибка: {e}")
            import traceback
            traceback.print_exc()
            await session.rollback()

if __name__ == "__main__":
    asyncio.run(fix_existing_users())
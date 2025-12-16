from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional, List

from app.models import Room

class RoomRepository:
    @staticmethod
    async def get_all_rooms(session: AsyncSession) -> List[Room]:
        try:
            print("📦 RoomRepository: Запрос всех комнат...")
            result = await session.execute(select(Room))
            rooms = list(result.scalars().all())
            print(f"📦 RoomRepository: Найдено {len(rooms)} комнат")
            
            for room in rooms:
                print(f"  - {room.name} (id: {room.id})")
            
            return rooms
        except Exception as e:
            print(f"❌ RoomRepository error: {str(e)}")
            raise
    
    @staticmethod
    async def get_room_by_id(session: AsyncSession, room_id: str) -> Optional[Room]:
        room = await session.get(Room, room_id)
        if room:
            print(f"📦 RoomRepository: Найдена комната {room.name}")
        else:
            print(f"📦 RoomRepository: Комната с ID {room_id} не найдена")
        return room
    
    @staticmethod
    async def create_room(session: AsyncSession, room_data: dict) -> Room:
        room = Room(**room_data)
        session.add(room)
        await session.commit()
        await session.refresh(room)
        print(f"📦 RoomRepository: Создана комната {room.name}")
        return room
    
    @staticmethod
    async def update_room(session: AsyncSession, room_id: str, update_data: dict) -> Optional[Room]:
        room = await RoomRepository.get_room_by_id(session, room_id)
        if room:
            for key, value in update_data.items():
                setattr(room, key, value)
            await session.commit()
            await session.refresh(room)
            print(f"📦 RoomRepository: Обновлена комната {room.name}")
        return room
    
    @staticmethod
    async def delete_room(session: AsyncSession, room_id: str) -> bool:
        room = await RoomRepository.get_room_by_id(session, room_id)
        if room:
            await session.delete(room)
            await session.commit()
            print(f"📦 RoomRepository: Удалена комната {room.name}")
            return True
        return False
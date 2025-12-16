from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import uuid

from app.models import Room
from app.schemes.room_schema import RoomCreateSchema
from app.exceptions.room_exceptions import RoomNotFound, InvalidRoomData
from app.repositories.room_repository import RoomRepository

class RoomService:
    @staticmethod
    async def get_all_rooms(session: AsyncSession):
        try:
            print("🔄 Получение всех комнат из базы...")
            rooms = await RoomRepository.get_all_rooms(session)
            print(f"✅ Успешно получено {len(rooms)} комнат")
            return rooms
        except Exception as e:
            print(f"❌ Ошибка в RoomService.get_all_rooms: {str(e)}")
            raise
    
    @staticmethod
    async def get_room_by_id(session: AsyncSession, room_id: str):
        print(f"🔍 Поиск комнаты по ID: {room_id}")
        room = await RoomRepository.get_room_by_id(session, room_id)
        if not room:
            raise RoomNotFound(f"Room with id {room_id} not found")
        return room
    
    @staticmethod
    async def create_room(session: AsyncSession, name: str, capacity: int, amenities: str = "", price: float = 0):
        print(f"🏗️ Создание комнаты: {name}, вместимость: {capacity}")
    
        if not name:
            raise InvalidRoomData("Room name is required")
    
        if capacity <= 0:
            raise InvalidRoomData("Room capacity must be positive")
    
        import uuid
        new_room = Room(
            id=f"room_{uuid.uuid4().hex[:8]}",
            name=name,
            capacity=capacity,
            amenities=amenities,
            price=price
        )
    
        session.add(new_room)
        await session.commit()
        await session.refresh(new_room)
    
        print(f"✅ Комната создана: {new_room.name}")
        return new_room
    
    @staticmethod
    async def update_room(session: AsyncSession, room_id: str, room_data: RoomCreateSchema):
        room = await RoomService.get_room_by_id(session, room_id)
        
        if not room_data.name:
            raise InvalidRoomData("Room name is required")
        
        if room_data.capacity <= 0:
            raise InvalidRoomData("Room capacity must be positive")
        
        # Проверяем, не занято ли это имя другим помещением
        existing = await session.execute(
            select(Room).where(
                Room.name == room_data.name,
                Room.id != room_id
            )
        )
        if existing.scalar():
            raise InvalidRoomData(f"Room with name '{room_data.name}' already exists")
        
        room.name = room_data.name
        room.capacity = room_data.capacity
        room.amenities = room_data.amenities
        room.price = room_data.price
        
        await session.commit()
        await session.refresh(room)
        return room
    
    @staticmethod
    async def delete_room(session: AsyncSession, room_id: str):
        room = await RoomService.get_room_by_id(session, room_id)
        
        await session.delete(room)
        await session.commit()
        return True
    
    @staticmethod
    async def get_available_rooms(session: AsyncSession, date, start_time, end_time):
        """Получить доступные комнаты на указанное время"""
        all_rooms = await RoomService.get_all_rooms(session)
        
        # Получаем бронирования на эту дату
        from app.models import Booking
        from sqlalchemy import select
        
        result = await session.execute(
            select(Booking).where(Booking.date == date)
        )
        bookings = result.scalars().all()
        
        # Фильтруем комнаты, которые заняты в указанное время
        available_rooms = []
        for room in all_rooms:
            room_bookings = [b for b in bookings if b.room_id == room.id]
            
            is_available = True
            for booking in room_bookings:
                # Проверяем пересечение временных интервалов
                if not (end_time <= booking.start_time or start_time >= booking.end_time):
                    is_available = False
                    break
            
            if is_available:
                available_rooms.append(room)
        
        return available_rooms
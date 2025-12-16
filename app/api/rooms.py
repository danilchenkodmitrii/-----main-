from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import traceback

from app.models import get_db, Room  # Убедитесь, что Room импортирован
from app.services.room_service import RoomService
from app.schemes.room_schema import RoomCreateSchema  # Убедитесь, что схема импортирована
from app.exceptions.room_exceptions import RoomNotFound, InvalidRoomData

rooms_router = APIRouter()

@rooms_router.get("/")
async def get_all_rooms(db: AsyncSession = Depends(get_db)):
    try:
        print("🏢 Запрос всех комнат...")
        rooms = await RoomService.get_all_rooms(db)
        print(f"✅ Найдено {len(rooms)} комнат")
        return [room.to_dict() for room in rooms]
    except Exception as e:
        print(f"❌ Ошибка при получении комнат: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Server error: {str(e)}")

@rooms_router.get("/{room_id}")
async def get_room(room_id: str, db: AsyncSession = Depends(get_db)):
    try:
        room = await RoomService.get_room_by_id(db, room_id)
        return room.to_dict()
    except RoomNotFound as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        print(f"❌ Ошибка при получении комнаты {room_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Server error: {str(e)}")

@rooms_router.post("/")
async def create_room(data: dict, db: AsyncSession = Depends(get_db)):  # Добавьте Depends(db)
    try:
        print(f"🏗️ Создание комнаты: {data}")
        
        # Проверяем обязательные поля
        if not data.get("name"):
            raise HTTPException(status_code=400, detail="Room name is required")
        
        if not data.get("capacity"):
            raise HTTPException(status_code=400, detail="Room capacity is required")
        
        # Используем RoomService для создания
        room = await RoomService.create_room(
            db, 
            data["name"], 
            int(data["capacity"]), 
            data.get("amenities", ""), 
            float(data.get("price", 0))
        )
        
        print(f"✅ Комната создана: {room.name}")
        return room.to_dict()
        
    except InvalidRoomData as e:
        print(f"❌ Неверные данные комнаты: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"❌ Ошибка при создании комнаты: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Server error: {str(e)}")

@rooms_router.put("/{room_id}")
async def update_room(room_id: str, data: dict, db: AsyncSession = Depends(get_db)):
    try:
        room = await RoomService.update_room(
            db, 
            room_id, 
            data.get("name"), 
            data.get("capacity"), 
            data.get("amenities"), 
            data.get("price")
        )
        if not room:
            raise HTTPException(status_code=404, detail="Room not found")
        return room.to_dict()
    except RoomNotFound as e:
        raise HTTPException(status_code=404, detail=str(e))
    except InvalidRoomData as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"❌ Ошибка при обновлении комнаты: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Server error: {str(e)}")

@rooms_router.put("/{room_id}/price")
async def update_room_price(room_id: str, data: dict, db: AsyncSession = Depends(get_db)):
    try:
        room = await RoomService.update_room_price(db, room_id, data.get("price"))
        if not room:
            raise HTTPException(status_code=404, detail="Room not found")
        return room.to_dict()
    except RoomNotFound as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        print(f"❌ Ошибка при обновлении цены комнаты: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Server error: {str(e)}")

@rooms_router.delete("/{room_id}")
async def delete_room(room_id: str, db: AsyncSession = Depends(get_db)):
    try:
        success = await RoomService.delete_room(db, room_id)
        if not success:
            raise HTTPException(status_code=404, detail="Room not found")
        return {"status": "Room deleted"}
    except RoomNotFound as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        print(f"❌ Ошибка при удалении комнаты: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Server error: {str(e)}")
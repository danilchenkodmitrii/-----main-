from fastapi import APIRouter, HTTPException, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_
from datetime import date, datetime
import traceback
import uuid

from app.models import get_db, Booking, User, Room  # ← Добавьте User и Room!
from app.services.booking_service import BookingService
from app.schemes.booking_schema import BookingCreateSchema
from app.exceptions.booking_exceptions import BookingNotFound, TimeSlotNotAvailable, InvalidBookingData

bookings_router = APIRouter()

@bookings_router.get("/")
async def get_all_bookings(
    db: AsyncSession = Depends(get_db),
    room_id: str = Query(None),
    user_id: str = Query(None),
    booking_date: date = Query(None)
):
    try:
        print(f"📅 Запрос бронирований: room_id={room_id}, user_id={user_id}, date={booking_date}")
        
        query = select(Booking)
        
        filters = []
        if room_id:
            filters.append(Booking.room_id == room_id)
        if user_id:
            filters.append(Booking.user_id == user_id)
        if booking_date:
            if isinstance(booking_date, str):
                date_obj = datetime.strptime(booking_date, "%Y-%m-%d").date()
                filters.append(Booking.date == date_obj)
            else:
                filters.append(Booking.date == booking_date)
        
        if filters:
            query = query.where(and_(*filters))
        
        result = await db.execute(query)
        bookings = result.scalars().all()
        
        # Загружаем связанные данные
        bookings_list = []
        for booking in bookings:
            await db.refresh(booking, ['user', 'room'])
            bookings_list.append(booking.to_dict())
        
        print(f"✅ Найдено {len(bookings_list)} бронирований")
        return bookings_list
        
    except Exception as e:
        print(f"❌ Ошибка при получении бронирований: {str(e)}")
        traceback.print_exc()
        return []

@bookings_router.post("/")
async def create_booking(booking_data: BookingCreateSchema, db: AsyncSession = Depends(get_db)):
    """Создание бронирования - ИСПРАВЛЕННАЯ ВЕРСИЯ с импортами"""
    try:
        print(f"📝 Создание бронирования: {booking_data}")
        
        # Используем camelCase поля из схемы!
        room_id = booking_data.roomId      # ← camelCase!
        user_id = booking_data.userId      # ← camelCase!
        start_time = booking_data.startTime
        end_time = booking_data.endTime
        date_str = booking_data.date
        title = booking_data.title
        participants = booking_data.participants or []
        
        print(f"   room_id: {room_id}")
        print(f"   user_id: {user_id}")
        print(f"   date: {date_str}")
        print(f"   time: {start_time}-{end_time}")
        
        # Проверяем существование пользователя и комнаты
        # User и Room должны быть импортированы!
        user = await db.get(User, user_id)
        if not user:
            raise HTTPException(status_code=404, detail=f"Пользователь {user_id} не найден")
        
        room = await db.get(Room, room_id)
        if not room:
            raise HTTPException(status_code=404, detail=f"Комната {room_id} не найдена")
        
        # Преобразуем дату
        try:
            booking_date = datetime.strptime(date_str, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=400, detail="Неверный формат даты. Используйте YYYY-MM-DD")
        
        # Проверяем доступность времени
        conflicting = await db.execute(
            select(Booking).where(
                and_(
                    Booking.room_id == room_id,
                    Booking.date == booking_date,
                    or_(
                        and_(Booking.start_time < end_time, Booking.end_time > start_time)
                    )
                )
            )
        )
        
        if conflicting.scalar():
            raise HTTPException(status_code=400, detail="Это время уже занято")
        
        # Создаем бронирование
        new_booking = Booking(
            id=f"booking_{uuid.uuid4().hex[:8]}",
            room_id=room_id,
            user_id=user_id,
            date=booking_date,
            start_time=start_time,
            end_time=end_time,
            title=title,
            participants=",".join(participants) if participants else ""
        )
        
        db.add(new_booking)
        await db.commit()
        await db.refresh(new_booking)
        
        # Загружаем связи
        await db.refresh(new_booking, ['user', 'room'])
        
        print(f"✅ Бронирование создано: {new_booking.id}")
        return new_booking.to_dict()
            
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Неожиданная ошибка: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Server error: {str(e)}")

@bookings_router.get("/{booking_id}")
async def get_booking(booking_id: str, db: AsyncSession = Depends(get_db)):
    try:
        booking = await BookingService.get_booking_by_id(db, booking_id)
        return booking.to_dict()
    except BookingNotFound as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        print(f"❌ Ошибка при получении бронирования {booking_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Server error: {str(e)}")

@bookings_router.delete("/{booking_id}")
async def delete_booking(booking_id: str, db: AsyncSession = Depends(get_db)):
    try:
        print(f"🗑️ Удаление бронирования: {booking_id}")
        await BookingService.delete_booking(db, booking_id)
        print(f"✅ Бронирование удалено: {booking_id}")
        return {"message": f"Booking {booking_id} deleted successfully"}
    except BookingNotFound as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        print(f"❌ Ошибка при удалении бронирования: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Server error: {str(e)}")
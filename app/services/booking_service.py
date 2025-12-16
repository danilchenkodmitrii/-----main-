from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_
from datetime import datetime, date
import uuid

from app.models import Booking, User, Room
from app.schemes.booking_schema import BookingCreateSchema
from app.exceptions.booking_exceptions import BookingNotFound, TimeSlotNotAvailable, InvalidBookingData
from app.repositories.booking_repository import BookingRepository

class BookingService:
    @staticmethod
    async def get_all_bookings(session: AsyncSession, room_id=None, user_id=None, booking_date=None):
        try:
            print(f"📦 BookingService: Запрос бронирований...")
            bookings = await BookingRepository.get_all_bookings(session, room_id, user_id, booking_date)
            print(f"📦 BookingService: Найдено {len(bookings)} бронирований")
            return bookings
        except Exception as e:
            print(f"❌ BookingService error: {str(e)}")
            raise
    
    @staticmethod
    async def get_booking_by_id(session: AsyncSession, booking_id: str):
        print(f"🔍 Поиск бронирования по ID: {booking_id}")
        booking = await BookingRepository.get_booking_by_id(session, booking_id)
        if not booking:
            raise BookingNotFound(f"Booking with id {booking_id} not found")
        return booking
    
    @staticmethod
    async def create_booking(session: AsyncSession, booking_data: BookingCreateSchema):
        # Проверяем существование пользователя и комнаты
        user = await session.get(User, booking_data.user_id)
        if not user:
            raise InvalidBookingData(f"User with id {booking_data.user_id} not found")
        
        room = await session.get(Room, booking_data.room_id)
        if not room:
            raise InvalidBookingData(f"Room with id {booking_data.room_id} not found")
        
        # Проверяем доступность временного слота
        conflicting_bookings = await session.execute(
            select(Booking).where(
                and_(
                    Booking.room_id == booking_data.room_id,
                    Booking.date == booking_data.date,
                    or_(
                        and_(
                            Booking.start_time < booking_data.end_time,
                            Booking.end_time > booking_data.start_time
                        )
                    )
                )
            )
        )
        
        if conflicting_bookings.scalar():
            raise TimeSlotNotAvailable(
                f"Time slot {booking_data.start_time}-{booking_data.end_time} "
                f"on {booking_data.date} is not available for room {room.name}"
            )
        
        # Проверяем, что дата не в прошлом
        if booking_data.date < date.today():
            raise InvalidBookingData("Cannot book for past dates")
        
        # Проверяем правильность временного интервала
        try:
            start_dt = datetime.strptime(booking_data.start_time, "%H:%M")
            end_dt = datetime.strptime(booking_data.end_time, "%H:%M")
            if end_dt <= start_dt:
                raise InvalidBookingData("End time must be after start time")
        except ValueError:
            raise InvalidBookingData("Invalid time format. Use HH:MM")
        
        new_booking = Booking(
            id=f"booking_{uuid.uuid4().hex[:8]}",
            room_id=booking_data.room_id,
            user_id=booking_data.user_id,
            date=booking_data.date,
            start_time=booking_data.start_time,
            end_time=booking_data.end_time,
            title=booking_data.title,
            participants=booking_data.participants
        )
        
        session.add(new_booking)
        await session.commit()
        await session.refresh(new_booking)
        return new_booking
    
    @staticmethod
    async def delete_booking(session: AsyncSession, booking_id: str):
        booking = await BookingService.get_booking_by_id(session, booking_id)
        
        await session.delete(booking)
        await session.commit()
        return True
    
    @staticmethod
    async def get_user_bookings(session: AsyncSession, user_id: str):
        result = await session.execute(
            select(Booking).where(Booking.user_id == user_id)
        )
        return result.scalars().all()
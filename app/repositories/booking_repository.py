from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models import Booking, Room, User
from datetime import date, datetime
import uuid

class BookingRepository:
    @staticmethod
    async def get_all_bookings(session: AsyncSession):
        result = await session.execute(select(Booking))
        return result.scalars().all()

    @staticmethod
    async def get_booking_by_id(session: AsyncSession, booking_id: str):
        result = await session.execute(select(Booking).where(Booking.id == booking_id))
        return result.scalar()

    @staticmethod
    async def get_room_bookings(session: AsyncSession, room_id: str):
        result = await session.execute(select(Booking).where(Booking.room_id == room_id))
        return result.scalars().all()

    @staticmethod
    async def get_user_bookings(session: AsyncSession, user_id: str):
        result = await session.execute(select(Booking).where(Booking.user_id == user_id))
        return result.scalars().all()

    @staticmethod
    async def get_bookings_by_date(session: AsyncSession, booking_date: date):
        result = await session.execute(select(Booking).where(Booking.date == booking_date))
        return result.scalars().all()

    @staticmethod
    async def check_availability(session: AsyncSession, room_id: str, booking_date: date, start_time: str, end_time: str):
        bookings = await BookingRepository.get_room_bookings(session, room_id)
        day_bookings = [b for b in bookings if b.date == booking_date]

        for booking in day_bookings:
            if not (end_time <= booking.start_time or start_time >= booking.end_time):
                return False
        return True

    @staticmethod
    async def create_booking(session: AsyncSession, room_id: str, user_id: str, booking_date: date, start_time: str, end_time: str, title: str, participants: list = None):
        available = await BookingRepository.check_availability(session, room_id, booking_date, start_time, end_time)
        if not available:
            return None

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
        session.add(new_booking)
        await session.commit()
        await session.refresh(new_booking)
        return new_booking

    @staticmethod
    async def update_booking(session: AsyncSession, booking_id: str, start_time: str = None, end_time: str = None, title: str = None):
        booking = await BookingRepository.get_booking_by_id(session, booking_id)
        if not booking:
            return None

        if start_time:
            booking.start_time = start_time
        if end_time:
            booking.end_time = end_time
        if title:
            booking.title = title

        await session.commit()
        await session.refresh(booking)
        return booking

    @staticmethod
    async def delete_booking(session: AsyncSession, booking_id: str):
        booking = await BookingRepository.get_booking_by_id(session, booking_id)
        if not booking:
            return False

        await session.delete(booking)
        await session.commit()
        return True
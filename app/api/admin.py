from fastapi import APIRouter, HTTPException
from sqlalchemy import select, func
from ..models import User, Room, Booking, Role, async_session

admin_router = APIRouter()

@admin_router.get("/users")
async def get_all_users():
    async with async_session() as session:
        result = await session.execute(select(User))
        users = result.scalars().all()
        return [user.to_dict() for user in users]

@admin_router.put("/users/{user_id}/role")
async def update_user_role(user_id: str, data: dict):
    async with async_session() as session:
        # Найти пользователя
        user_result = await session.execute(select(User).where(User.id == user_id))
        user = user_result.scalar()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Найти роль
        role_result = await session.execute(select(Role).where(Role.name == data.get("role")))
        role = role_result.scalar()
        if not role:
            raise HTTPException(status_code=404, detail="Role not found")
        
        user.role_id = role.id
        await session.commit()
        return user.to_dict()

@admin_router.get("/stats")
async def get_stats():
    async with async_session() as session:
        # Получаем количество пользователей
        users_result = await session.execute(select(func.count(User.id)))
        users_count = users_result.scalar()
        
        # Получаем количество комнат
        rooms_result = await session.execute(select(func.count(Room.id)))
        rooms_count = rooms_result.scalar()
        
        # Получаем количество бронирований
        bookings_result = await session.execute(select(func.count(Booking.id)))
        bookings_count = bookings_result.scalar()
        
        return {
            "totalUsers": users_count or 0,
            "totalRooms": rooms_count or 0,
            "totalBookings": bookings_count or 0
        }
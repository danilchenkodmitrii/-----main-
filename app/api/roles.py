from fastapi import APIRouter, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ..models import Role
from ..models import async_session

roles_router = APIRouter()

@roles_router.get("/")
async def get_all_roles():
    async with async_session() as session:
        result = await session.execute(select(Role))
        roles = result.scalars().all()
        return [role.to_dict() for role in roles]

@roles_router.get("/{role_id}")
async def get_role(role_id: int):
    async with async_session() as session:
        result = await session.execute(select(Role).where(Role.id == role_id))
        role = result.scalar()
        if role:
            return role.to_dict()
        raise HTTPException(status_code=404, detail="Role not found")

@roles_router.post("/")
async def create_role(data: dict):
    async with async_session() as session:
        existing = await session.execute(select(Role).where(Role.name == data.get("name")))
        if existing.scalar():
            raise HTTPException(status_code=400, detail="Role already exists")
        
        new_role = Role(name=data["name"], description=data.get("description", ""))
        session.add(new_role)
        await session.commit()
        return new_role.to_dict()

@roles_router.put("/{role_id}")
async def update_role(role_id: int, data: dict):
    async with async_session() as session:
        result = await session.execute(select(Role).where(Role.id == role_id))
        role = result.scalar()
        if not role:
            raise HTTPException(status_code=404, detail="Role not found")
        
        role.name = data.get("name", role.name)
        role.description = data.get("description", role.description)
        await session.commit()
        return role.to_dict()

@roles_router.delete("/{role_id}")
async def delete_role(role_id: int):
    async with async_session() as session:
        result = await session.execute(select(Role).where(Role.id == role_id))
        role = result.scalar()
        if not role:
            raise HTTPException(status_code=404, detail="Role not found")
        
        await session.delete(role)
        await session.commit()
        return {"status": "Role deleted"}
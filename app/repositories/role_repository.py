from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models import Role

class RoleRepository:
    @staticmethod
    async def get_all_roles(session: AsyncSession):
        result = await session.execute(select(Role))
        return result.scalars().all()
    
    @staticmethod
    async def get_role_by_id(session: AsyncSession, role_id: int):
        result = await session.execute(select(Role).where(Role.id == role_id))
        return result.scalar()
    
    @staticmethod
    async def get_role_by_name(session: AsyncSession, name: str):
        result = await session.execute(select(Role).where(Role.name == name))
        return result.scalar()
    
    @staticmethod
    async def create_role(session: AsyncSession, name: str, description: str = ""):
        existing = await RoleRepository.get_role_by_name(session, name)
        if existing:
            return None
        
        role = Role(name=name, description=description)
        session.add(role)
        await session.commit()
        await session.refresh(role)
        return role
    
    @staticmethod
    async def update_role(session: AsyncSession, role_id: int, name: str = None, description: str = None):
        role = await RoleRepository.get_role_by_id(session, role_id)
        if not role:
            return None
        
        if name:
            role.name = name
        if description:
            role.description = description
        
        await session.commit()
        await session.refresh(role)
        return role
    
    @staticmethod
    async def delete_role(session: AsyncSession, role_id: int):
        role = await RoleRepository.get_role_by_id(session, role_id)
        if not role:
            return False
        
        await session.delete(role)
        await session.commit()
        return True


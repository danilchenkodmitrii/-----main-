from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional

from app.models import Role, User
from app.exceptions.role_exceptions import RoleNotFound, InvalidRoleData
from app.repositories.role_repository import RoleRepository

class RoleService:
    @staticmethod
    async def get_all_roles(session: AsyncSession):
        return await RoleRepository.get_all_roles(session)
    
    @staticmethod
    async def get_role_by_id(session: AsyncSession, role_id: int):
        role = await RoleRepository.get_role_by_id(session, role_id)
        if not role:
            raise RoleNotFound(f"Role with id {role_id} not found")
        return role
    
    @staticmethod
    async def get_role_by_name(session: AsyncSession, name: str):
        role = await RoleRepository.get_role_by_name(session, name)
        if not role:
            raise RoleNotFound(f"Role with name {name} not found")
        return role
    
    @staticmethod
    async def create_role(session: AsyncSession, name: str, description: str = ""):
        existing = await RoleRepository.get_role_by_name(session, name)
        if existing:
            raise InvalidRoleData(f"Role with name {name} already exists")
        
        role = Role(name=name, description=description)
        session.add(role)
        await session.commit()
        await session.refresh(role)
        return role
    
    @staticmethod
    async def update_role(session: AsyncSession, role_id: int, name: Optional[str] = None, 
                         description: Optional[str] = None):
        role = await RoleService.get_role_by_id(session, role_id)
        
        if name:
            # Проверяем, не существует ли роли с таким именем
            existing = await RoleRepository.get_role_by_name(session, name)
            if existing and existing.id != role_id:
                raise InvalidRoleData(f"Role with name {name} already exists")
            role.name = name
        
        if description is not None:
            role.description = description
        
        await session.commit()
        await session.refresh(role)
        return role
    
    @staticmethod
    async def delete_role(session: AsyncSession, role_id: int):
        role = await RoleService.get_role_by_id(session, role_id)
        
        # Проверяем, нет ли пользователей с этой ролью
        users_result = await session.execute(select(User).where(User.role_id == role_id))
        users_with_role = users_result.scalars().all()
        
        if users_with_role:
            raise InvalidRoleData(f"Cannot delete role {role.name}. {len(users_with_role)} users have this role.")
        
        await session.delete(role)
        await session.commit()
        return True
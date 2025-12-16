from pydantic import BaseModel
from typing import Optional

class UserCreateSchema(BaseModel):
    firstName: str
    lastName: str
    email: str
    password: str

class UserResponseSchema(BaseModel):
    id: str
    name: str
    firstName: str
    lastName: str
    email: str
    role: str
    createdAt: str

class UserRoleUpdateSchema(BaseModel):
    role: str
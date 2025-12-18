from pydantic import BaseModel, EmailStr, validator
from typing import Optional
import re

class UserLoginSchema(BaseModel):
    email: str
    password: str

    @validator('email')
    def validate_login_email(cls, v):
        v = v.strip().lower()
        if not v:
            raise ValueError('Email обязателен для заполнения')
        if len(v) > 100:
            raise ValueError('Email слишком длинный (максимум 100 символов)')
        if not re.match(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', v):
            raise ValueError('Неверный формат email адреса')
        return v

    @validator('password')
    def validate_login_password(cls, v):
        if not v:
            raise ValueError('Пароль обязателен для заполнения')
        if len(v) > 100:
            raise ValueError('Пароль слишком длинный (максимум 100 символов)')
        return v

class UserCreateSchema(BaseModel):
    firstName: str
    lastName: str
    email: str
    password: str

    @validator('firstName')
    def validate_first_name(cls, v):
        v = v.strip()
        if len(v) < 2:
            raise ValueError('Имя должно содержать минимум 2 символа')
        if len(v) > 50:
            raise ValueError('Имя не должно превышать 50 символов')
        if not re.match(r'^[a-zA-Zа-яА-ЯёЁ\s\-]+$', v):
            raise ValueError('Имя может содержать только буквы, пробелы и дефисы')
        return v

    @validator('lastName')
    def validate_last_name(cls, v):
        v = v.strip()
        if len(v) < 2:
            raise ValueError('Фамилия должна содержать минимум 2 символа')
        if len(v) > 50:
            raise ValueError('Фамилия не должна превышать 50 символов')
        if not re.match(r'^[a-zA-Zа-яА-ЯёЁ\s\-]+$', v):
            raise ValueError('Фамилия может содержать только буквы, пробелы и дефисы')
        return v

    @validator('email')
    def validate_email(cls, v):
        v = v.strip().lower()
        if len(v) > 100:
            raise ValueError('Email не должен превышать 100 символов')
        if not re.match(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', v):
            raise ValueError('Введите корректный email адрес')
        return v

    @validator('password')
    def validate_password(cls, v):
        if len(v) < 4:
            raise ValueError('Пароль должен содержать минимум 4 символа')
        if len(v) > 100:
            raise ValueError('Пароль не должен превышать 100 символов')
        return v

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
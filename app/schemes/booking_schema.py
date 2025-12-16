from pydantic import BaseModel
from typing import Optional, List

class BookingCreateSchema(BaseModel):
    roomId: str
    userId: str
    date: str
    startTime: str
    endTime: str
    title: str
    participants: Optional[List[str]] = []

class BookingUpdateSchema(BaseModel):
    startTime: Optional[str] = None
    endTime: Optional[str] = None
    title: Optional[str] = None

class BookingResponseSchema(BaseModel):
    id: str
    roomId: str
    userId: str
    userName: str
    date: str
    startTime: str
    endTime: str
    title: str
    participants: List[str]
    createdAt: str
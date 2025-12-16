from pydantic import BaseModel
from typing import Optional

class RoomCreateSchema(BaseModel):
    name: str
    capacity: int
    amenities: Optional[str] = ""
    price: Optional[float] = 0

class RoomUpdateSchema(BaseModel):
    name: Optional[str] = None
    capacity: Optional[int] = None
    amenities: Optional[str] = None
    price: Optional[float] = None

class RoomResponseSchema(BaseModel):
    id: str
    name: str
    capacity: int
    amenities: str
    price: float
    createdAt: str
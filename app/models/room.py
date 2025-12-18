from sqlalchemy import Column, String, Integer, Text, Float, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
from .base import Base

class Room(Base):
    __tablename__ = "rooms"

    id = Column(String(36), primary_key=True)
    name = Column(String(255), nullable=False)
    capacity = Column(Integer, nullable=False)
    amenities = Column(Text)
    price = Column(Float, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    bookings = relationship("Booking", back_populates="room", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "capacity": self.capacity,
            "amenities": self.amenities or "",
            "price": self.price,
            "createdAt": self.created_at.isoformat()
        }
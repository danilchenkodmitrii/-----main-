from sqlalchemy import Column, String, Integer, Date, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from .base import Base

class Booking(Base):
    __tablename__ = "bookings"

    id = Column(String(36), primary_key=True)
    room_id = Column(String(36), ForeignKey("rooms.id"), nullable=False)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    date = Column(Date, nullable=False)
    start_time = Column(String(5), nullable=False)
    end_time = Column(String(5), nullable=False)
    title = Column(String(255), nullable=False)
    participants = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    user = relationship("User", back_populates="bookings")
    room = relationship("Room", back_populates="bookings")

    def to_dict(self):
        participants = []
        if self.participants:
            participants = [p.strip() for p in self.participants.split(",")]

        return {
            "id": self.id,
            "roomId": self.room_id,
            "userId": self.user_id,
            "userName": self.user.first_name + " " + self.user.last_name if self.user else "",
            "date": self.date.isoformat() if self.date else "",
            "startTime": self.start_time,
            "endTime": self.end_time,
            "title": self.title,
            "participants": participants,
            "createdAt": self.created_at.isoformat() if self.created_at else ""
        }
class RoomException(Exception):
    """Base exception for room operations"""
    pass

class RoomNotFound(RoomException):
    """Raised when room is not found"""
    pass

class InvalidRoomData(RoomException):
    """Raised when room data is invalid"""
    pass


class BookingException(Exception):
    """Base exception for booking operations"""
    pass

class TimeSlotNotAvailable(BookingException):
    """Raised when the requested time slot is not available"""
    pass

class BookingNotFound(BookingException):
    """Raised when booking is not found"""
    pass

class InvalidBookingData(BookingException):
    """Raised when booking data is invalid"""
    pass


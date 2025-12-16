class UserException(Exception):
    """Base exception for user operations"""
    pass

class UserNotFound(UserException):
    """Raised when user is not found"""
    pass

class UserAlreadyExists(UserException):
    """Raised when trying to create user with existing email"""
    pass

class InvalidUserData(UserException):
    """Raised when user data is invalid"""
    pass

class InvalidPassword(UserException):
    """Raised when password is invalid"""
    pass


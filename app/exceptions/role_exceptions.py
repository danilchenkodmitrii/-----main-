class RoleException(Exception):
    """Base exception for role operations"""
    pass

class RoleNotFound(RoleException):
    """Raised when role is not found"""
    pass

class InvalidRoleData(RoleException):
    """Raised when role data is invalid"""
    pass


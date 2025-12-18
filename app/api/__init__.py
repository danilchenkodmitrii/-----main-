from .users import users_router
from .rooms import rooms_router
from .bookings import bookings_router
from .admin import admin_router
from .roles import roles_router
from .debug import debug_router

__all__ = [
    'users_router', 
    'rooms_router', 
    'bookings_router', 
    'admin_router', 
    'roles_router',
    'debug_router'
]
"""
Для обратной совместимости. Основная конфигурация в app/models/models.py
"""
from app.models import init_db

# Для обратной совместимости
__all__ = ['init_db']
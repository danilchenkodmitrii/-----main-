const API_BASE = '/api/users'; // Исправлен путь

class AuthModule {
  constructor() {
    this.users = [];
    this.currentUser = null;
  }

  async initializeUsers() {
    try {
      const response = await fetch(`${API_BASE}/`);
      if (response.ok) {
        this.users = await response.json();
      }
    } catch (error) {
      console.error('Error loading users:', error);
      // Запасные данные для демонстрации
      this.users = [
        { id: "user_1", name: "Алексей Иванов", email: "alex@company.com", role: "admin" },
        { id: "user_2", name: "Мария Петрова", email: "maria@company.com", role: "user" },
        { id: "user_3", name: "Иван Сидоров", email: "ivan@company.com", role: "user" }
      ];
    }
  }

  getCurrentUser() {
    const userData = localStorage.getItem('soveshaika_user');
    if (userData) {
      return JSON.parse(userData);
    }
    return null;
  }

  isAdmin() {
    const user = this.getCurrentUser();
    return user?.role === 'admin';
  }

  isManager() {
    const user = this.getCurrentUser();
    return user?.role === 'manager';
  }

  logout() {
    localStorage.removeItem('soveshaika_user');
    this.currentUser = null;
  }

  getAllUsers() {
    return this.users;
  }

  setCurrentUser(userId) {
    const user = this.users.find(u => u.id === userId);
    if (user) {
      localStorage.setItem('soveshaika_user', JSON.stringify(user));
      this.currentUser = user;
    }
  }

  async createUser(firstName, lastName, email, password) {
    try {
      const response = await fetch(`${API_BASE}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName, lastName, email, password })
      });

      if (!response.ok) {
        const error = await response.json();
        return { success: false, message: error.detail || 'Ошибка регистрации' };
      }

      const newUser = await response.json();
      this.users.push(newUser);
      localStorage.setItem('soveshaika_user', JSON.stringify(newUser));
      return { success: true, user: newUser };
    } catch (error) {
      console.error('Registration error:', error);
      return { success: false, message: 'Ошибка сети при регистрации' };
    }
  }

  async loginWithPassword(email, password) {
    try {
      const response = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      
      if (!response.ok) {
        const error = await response.json();
        return { success: false, message: error.detail || 'Неверный email или пароль' };
      }
      
      const user = await response.json();
      localStorage.setItem('soveshaika_user', JSON.stringify(user));
      this.currentUser = user;
      return { success: true, user };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, message: 'Ошибка сети при входе' };
    }
  }
}

const authModule = new AuthModule();

export async function initializeAuth() {
  await authModule.initializeUsers();
}

export function getCurrentUser() {
  return authModule.getCurrentUser();
}

export function isAdmin() {
  return authModule.isAdmin();
}

export function isManager() {
  return authModule.isManager();
}

export function logout() {
  authModule.logout();
}

export function getAllUsers() {
  return authModule.getAllUsers();
}

export function setCurrentUser(userId) {
  authModule.setCurrentUser(userId);
}

export function createUser(firstName, lastName, email, password) {
  return authModule.createUser(firstName, lastName, email, password);
}

export function loginWithPassword(email, password) {
  return authModule.loginWithPassword(email, password);
}
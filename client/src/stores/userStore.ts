import { create } from 'zustand';

interface UserState {
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  setUser: (id: string, name: string, email: string) => void;
  clearUser: () => void;
}

const useUserStore = create<UserState>((set) => ({
  userId: '550e8400-e29b-41d4-a716-446655440000',
  userName: '게스트',
  userEmail: 'guest@example.com',
  
  setUser: (id, name, email) => {
    set({ userId: id, userName: name, userEmail: email });
    localStorage.setItem('userId', id);
  },
  
  clearUser: () => {
    set({ userId: '550e8400-e29b-41d4-a716-446655440000', userName: '게스트', userEmail: 'guest@example.com' });
    localStorage.removeItem('userId');
  },
}));

export default useUserStore;
import { create } from 'zustand';

import type { AuthUser } from '@/feat/auth/types';
import { storageUtil } from '@/utils/storage';

interface AuthState {
  user: AuthUser | null;
  authStatus: 'unknown' | 'authenticated' | 'unauthenticated';
  hasSessionHint: boolean;
  actions: {
    setAuth: (user: AuthUser) => void;
    setUnauthenticated: () => void;
    clearAuth: () => void;
  };
}

// 초기 상태 정의
const getInitialState = () => ({
  user: null,
  authStatus: 'unknown' as const,
  // storageUtil을 통해 동기적으로 세션 힌트를 가져옴
  hasSessionHint: storageUtil.get().has_session_hint,
});

export const useAuthStore = create<AuthState>(set => ({
  ...getInitialState(),

  actions: {
    // 서버 검증 성공: 실제 유저 정보와 힌트 동시 업데이트
    setAuth: user => {
      storageUtil.setSessionHint(true);
      set({
        user,
        authStatus: 'authenticated',
        hasSessionHint: true,
      });
    },

    // 서버 검증 실패: 유저 정보는 없지만 힌트만 제거
    setUnauthenticated: () => {
      storageUtil.setSessionHint(false);
      set({
        user: null,
        authStatus: 'unauthenticated',
        hasSessionHint: false,
      });
    },

    // 로그아웃: 초기 상태로 완전 리셋
    clearAuth: () => {
      storageUtil.setSessionHint(false);
      // 초기 상태로 되돌리되, authStatus는 명시적으로 unauthenticated 설정
      set({
        ...getInitialState(),
        authStatus: 'unauthenticated',
        hasSessionHint: false,
      });
    },
  },
}));

export const useAuthUser = () => useAuthStore(state => state.user);
export const useAuthStatus = () => useAuthStore(state => state.authStatus);
export const useHasSessionHint = () => useAuthStore(state => state.hasSessionHint);
export const useAuthActions = () => useAuthStore(state => state.actions);
export const useIsLoggedIn = () => useAuthStore(state => state.authStatus === 'authenticated');

// 초기 상태 export (Storybook 등에서 사용)
export const initialState = getInitialState();

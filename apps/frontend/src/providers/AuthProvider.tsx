import { useEffect } from 'react';

import { authService } from '@/services/authService';
import { useAuthActions, useAuthStore } from '@/store/authStore';

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const { setAuth, setUnauthenticated } = useAuthActions();
  const { authStatus, hasSessionHint } = useAuthStore();

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // 먼저 /me로 유저 정보 확인
        const user = await authService.getCurrentUser();
        if (user) setAuth(user);
        // /me 실패 시 refresh 시도 (refreshToken은 쿠키에 있음)
        else {
          const refreshResult = await authService.refreshToken();

          if (refreshResult?.user) setAuth(refreshResult.user);
          else setUnauthenticated();
        }
      } catch {
        // 네트워크 에러 등 예외 발생 시 안전하게 로그아웃
        setUnauthenticated();
      }
    };

    initializeAuth();
  }, [setAuth, setUnauthenticated]);

  // 로그인 상태 확인 전 로딩 표시
  //TODO: 로딩 컴포넌트로 변경
  if (authStatus === 'unknown' && hasSessionHint) return null;

  return <>{children}</>;
};

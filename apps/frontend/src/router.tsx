import { createBrowserRouter, redirect } from 'react-router-dom';

import { SideBarLayout } from '@/layouts/SideBarLayout';
import { AdminQuizUpload } from '@/pages/admin/AdminQuizUpload';
import { AuthCheck } from '@/pages/auth/AuthCheck';
import { Login } from '@/pages/auth/Login';
import { GlobalError } from '@/pages/common/GlobalError';
import { NotFound } from '@/pages/common/NotFound';
import { ServicePreparation } from '@/pages/common/ServicePreparation';
import { Landing } from '@/pages/Landing';
import { Leaderboard } from '@/pages/Leaderboard';
import { InitialFields } from '@/pages/learn/InitialFields';
import { Learn } from '@/pages/learn/Learn';
import { Roadmap } from '@/pages/learn/Roadmap';
import { SelectField } from '@/pages/learn/SelectField';
import { Quiz } from '@/pages/quiz/Quiz';
import { QuizResult } from '@/pages/quiz/QuizResult';
import { QuizResultError } from '@/pages/quiz/QuizResultError';
import { Streak } from '@/pages/quiz/Streak';
import { Profile } from '@/pages/user/Profile';
import { Setting } from '@/pages/user/Setting';
import { useAuthStore } from '@/store/authStore';

// 보호된 페이지를 위한 공통 로더
const protectedLoader = () => {
  const authStatus = useAuthStore.getState().authStatus;
  if (authStatus !== 'authenticated') return redirect('/login');
  return null;
};

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Landing />,
    errorElement: <GlobalError />,
  },
  {
    path: '/login',
    element: <Login />,
  },
  {
    path: '/auth/check',
    element: <AuthCheck />,
  },

  // 학습 관련
  {
    path: '/learn',
    element: <SideBarLayout />,
    children: [
      { index: true, element: <Learn /> },
      { path: 'select-field', element: <SelectField /> },
      { path: 'roadmap', element: <Roadmap /> },
    ],
  },
  {
    path: '/learn/overview/:unitId',
    // element: <Overview />,
    element: <ServicePreparation />,
  },

  // 퀴즈 관련 (Quiz)
  {
    path: '/quiz',
    children: [
      { index: true, element: <Quiz /> }, // /quiz
      { path: 'result', element: <QuizResult /> }, // /quiz/result
      { path: 'error', element: <QuizResultError /> }, // /quiz/error
    ],
  },

  // 로그인 보호 + SideBarLayout 사용
  {
    loader: protectedLoader,
    element: <SideBarLayout />,
    children: [
      { path: '/streak', element: <Streak /> },
      { path: '/leaderboard', element: <Leaderboard /> },
      { path: '/profile/:userId', element: <Profile /> },
      { path: '/setting', element: <Setting /> },
    ],
  },

  // 관리자 (Admin)
  {
    path: '/admin',
    children: [
      {
        path: 'quizzes',
        children: [
          { path: 'upload', element: <AdminQuizUpload /> }, // /admin/quizzes/upload
        ],
      },
    ],
  },
  {
    path: '/initial-fields',
    element: <InitialFields />,
  },
  {
    path: '*',
    element: <NotFound />,
  },
]);

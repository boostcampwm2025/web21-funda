import { ThemeProvider } from '@emotion/react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';

import { ModalProvider } from '@/contexts/ModalContext';
import { AuthCheck } from '@/pages/AuthCheck';
import { Error } from '@/pages/Error';
import { Fields } from '@/pages/Fields';
import { Landing } from '@/pages/Landing';
// import { Leaderboard } from '@/pages/Leaderboard';
import { Learn } from '@/pages/Learn';
import { Login } from '@/pages/Login';
import { Overview } from '@/pages/Overview';
// import { Profile } from '@/pages/Profile';
import { Quiz } from '@/pages/Quiz';
import { QuizResult } from '@/pages/QuizResult';
import { ServicePreparation } from '@/pages/ServicePreparation';
// import { Setting } from '@/pages/Setting';
import { Streak } from '@/pages/Streak';
import { darkTheme, lightTheme } from '@/styles/theme';

const router = createBrowserRouter([
  {
    path: '/',
    element: <Landing />,
  },
  {
    path: '/fields',
    element: <Fields />,
  },
  {
    path: '/login',
    element: <Login />,
  },
  {
    path: '/learn',
    element: <Learn />,
  },
  {
    path: '/overview/:unitId',
    element: <Overview />,
  },
  {
    path: '/quiz/:unitId/:stepId',
    element: <Quiz />,
  },
  {
    path: '/quiz/:unitId/:stepId/result',
    element: <QuizResult />,
  },
  {
    path: '/auth/check',
    element: <AuthCheck />,
  },
  {
    path: '/streak',
    element: <Streak />,
  },
  {
    path: '/leaderboard/:groupId',
    // element: <Leaderboard />,
    element: <ServicePreparation />,
  },
  {
    path: '/setting',
    // element: <Setting />,
    element: <ServicePreparation />,
  },
  {
    path: '/profile/:userId',
    //element: <Profile />,
    element: <ServicePreparation />,
  },
  {
    path: '*',
    element: <Error />,
  },
]);

export default function App() {
  const isDarkMode = false;

  return (
    <ThemeProvider theme={isDarkMode ? darkTheme : lightTheme}>
      <ModalProvider>
        <RouterProvider router={router} />
      </ModalProvider>
    </ThemeProvider>
  );
}

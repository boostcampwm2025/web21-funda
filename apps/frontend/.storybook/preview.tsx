import { ThemeProvider } from '@emotion/react';
import type { Preview } from '@storybook/react-vite';
import { useEffect } from 'react';

import { useAuthStore } from '@/store/authStore';
import { darkTheme, lightTheme } from '@/styles/theme';

import '@/styles/main.css';

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    a11y: {
      test: 'todo',
    },
  },

  globalTypes: {
    authStatus: {
      name: 'Authentication',
      description: '로그인 상태 설정',
      defaultValue: 'logged-out',
      toolbar: {
        icon: 'user',
        items: [
          { value: 'logged-in', title: 'Logged In', left: '👤' },
          { value: 'logged-out', title: 'Logged Out', left: '🚫' },
        ],
        showName: true,
      },
    },
  },

  decorators: [
    (Story, context) => {
      const background = context.globals.backgrounds?.value;
      const theme = background === 'dark' ? darkTheme : lightTheme;

      const authStatus = context.parameters.authStatus || context.globals.authStatus;
      const targetState = authStatus === 'logged-in';

      useEffect(() => {
        if (targetState) {
          useAuthStore.setState({
            authStatus: 'authenticated',
            user: {
              id: 1,
              displayName: 'Test User',
              email: 'test@example.com',
              role: 'user',
              heartCount: 5,
              maxHeartCount: 5,
              experience: 100,
              currentStreak: 3,
              provider: 'github',
            },
            hasSessionHint: true,
          });
        } else {
          useAuthStore.setState({
            authStatus: 'unauthenticated',
            user: null,
            hasSessionHint: false,
          });
        }
        return () => {
          useAuthStore.setState({
            authStatus: 'unknown',
            user: null,
            hasSessionHint: false,
          });
        };
      }, [targetState]);
      return (
        <ThemeProvider theme={theme}>
          <Story />
        </ThemeProvider>
      );
    },
  ],
};

export default preview;

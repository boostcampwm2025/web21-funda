import { css, Global, ThemeProvider } from '@emotion/react';

import { Button } from './components/Button';
import { CodeBlock } from './components/CodeBlock';
import { darkTheme, lightTheme } from './styles/theme';

export default function App() {
  const isDarkMode = false;

  return (
    <ThemeProvider theme={isDarkMode ? darkTheme : lightTheme}>
      <Global styles={globalStyle} />
      <main css={pageStyle}>
        <section css={stackStyle}>
          <Button variant="primary" fullWidth>
            사용해 보기
          </Button>
          <Button variant="secondary" fullWidth>
            전 이미 계정이 있어요
          </Button>
          <CodeBlock>
            {`const example = () => {
    console.log('Hello, World!');
    return true;
  };`}
          </CodeBlock>
        </section>
      </main>
    </ThemeProvider>
  );
}

const globalStyle = css`
  * {
    box-sizing: border-box;
  }

  body {
    margin: 0;
    background: linear-gradient(180deg, #f7f7fc 0%, #eef1ff 100%);
    font-family:
      'SUIT',
      'Inter',
      -apple-system,
      BlinkMacSystemFont,
      'Segoe UI',
      sans-serif;
  }
`;

const pageStyle = css`
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px 24px 64px;
`;

const stackStyle = css`
  width: min(920px, 100%);
  display: flex;
  flex-direction: column;
  gap: 32px;
`;

import { ThemeProvider } from '@emotion/react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { ModalProvider } from '@/contexts/ModalContext';
import { Quiz } from '@/pages/Quiz';
import { lightTheme } from '@/styles/theme';

const renderQuiz = () =>
  render(
    <ThemeProvider theme={lightTheme}>
      <ModalProvider>
        <MemoryRouter>
          <Quiz />
        </MemoryRouter>
      </ModalProvider>
    </ThemeProvider>,
  );

describe('Quiz 컴포넌트 테스트', () => {
  it('사용자가 옵션을 클릭하면 선택 상태가 되고, 정답 확인 시 해설이 표시된다', async () => {
    renderQuiz();

    // 초기 상태 확인: 정답 확인 버튼이 비활성화되어 있어야 함
    const checkButton = screen.getByText('정답 확인');
    expect(checkButton).toBeDisabled();

    // 첫 번째 문제의 옵션('O(log n)') 클릭
    const option = screen.getByText('O(log n)');
    fireEvent.click(option);

    // 옵션 선택 후 버튼 활성화 확인
    expect(checkButton).not.toBeDisabled();

    // 정답 확인 버튼 클릭
    fireEvent.click(checkButton);

    // 로딩 상태 UI 확인
    expect(screen.getByText('정답 확인 중..')).toBeInTheDocument();

    // 1초 대기 후(setTimeout 시뮬레이션) 결과 화면 확인
    // waitFor는 요소가 나타날 때까지 기다림
    await waitFor(
      () => {
        expect(screen.getByText('다음 문제로')).toBeInTheDocument();
      },
      { timeout: 1500 },
    );
  });

  it('이미 선택한 옵션을 다시 클릭하면 선택이 해제된다', () => {
    renderQuiz();

    const option = screen.getByText('O(log n)');
    const checkButton = screen.getByText('정답 확인');

    fireEvent.click(option); // 선택
    expect(checkButton).not.toBeDisabled();

    fireEvent.click(option); // 다시 클릭 (해제)
    expect(checkButton).toBeDisabled();
  });
});

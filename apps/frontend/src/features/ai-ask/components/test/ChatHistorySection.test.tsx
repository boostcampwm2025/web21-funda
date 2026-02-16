import { ThemeProvider } from '@emotion/react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { AiQuestionAnswer } from '@/services/aiAskService';
import { lightTheme } from '@/styles/theme';

import { ChatHistorySection } from '../ChatHistorySection';

vi.mock('@/comp/MarkdownRenderer', () => ({
  MarkdownRenderer: ({ text }: { text: string }) => <div data-testid="markdown">{text}</div>,
}));

const renderChatHistory = (
  items: AiQuestionAnswer[],
  expandedIds: Set<number> = new Set(),
  onToggle: (id: number) => void = vi.fn(),
) =>
  render(
    <ThemeProvider theme={lightTheme}>
      <ChatHistorySection items={items} expandedIds={expandedIds} onToggle={onToggle} />
    </ThemeProvider>,
  );

describe('ChatHistorySection', () => {
  afterEach(() => {
    cleanup();
  });

  describe('기본 렌더링', () => {
    it('빈 배열일 때 빈 상태 메시지가 표시된다', () => {
      renderChatHistory([]);
      expect(screen.getByText('등록된 질문이 없습니다.')).toBeInTheDocument();
    });

    it('질문 목록이 렌더링된다', () => {
      const items: AiQuestionAnswer[] = [
        {
          id: 1,
          quizId: 1,
          question: '테스트 질문',
          answer: '테스트 답변',
          status: 'completed',
          createdAt: new Date().toISOString(),
          isMine: true,
        },
      ];

      renderChatHistory(items);
      expect(screen.getByText('테스트 질문')).toBeInTheDocument();
    });
  });

  describe('토글 기능', () => {
    it('질문 클릭 시 onToggle이 호출된다', () => {
      const onToggle = vi.fn();
      const items: AiQuestionAnswer[] = [
        {
          id: 1,
          quizId: 1,
          question: '테스트 질문',
          answer: '테스트 답변',
          status: 'completed',
          createdAt: new Date().toISOString(),
          isMine: true,
        },
      ];

      renderChatHistory(items, new Set(), onToggle);
      const toggleButton = screen.getByRole('button', { name: '테스트 질문 답변 보기' });
      fireEvent.click(toggleButton);

      expect(onToggle).toHaveBeenCalledWith(1);
    });

    it('확장된 질문은 답변이 표시된다', () => {
      const items: AiQuestionAnswer[] = [
        {
          id: 1,
          quizId: 1,
          question: '테스트 질문',
          answer: '테스트 답변',
          status: 'completed',
          createdAt: new Date().toISOString(),
          isMine: true,
        },
      ];

      renderChatHistory(items, new Set([1]));
      expect(screen.getByTestId('markdown')).toBeInTheDocument();
      expect(screen.getByText('테스트 답변')).toBeInTheDocument();
    });

    it('축소된 질문은 답변이 표시되지 않는다', () => {
      const items: AiQuestionAnswer[] = [
        {
          id: 1,
          quizId: 1,
          question: '테스트 질문',
          answer: '테스트 답변',
          status: 'completed',
          createdAt: new Date().toISOString(),
          isMine: true,
        },
      ];

      renderChatHistory(items, new Set());
      expect(screen.queryByTestId('markdown')).not.toBeInTheDocument();
    });

    it('키보드 Enter 키로 토글할 수 있다', () => {
      const onToggle = vi.fn();
      const items: AiQuestionAnswer[] = [
        {
          id: 1,
          quizId: 1,
          question: '테스트 질문',
          answer: '테스트 답변',
          status: 'completed',
          createdAt: new Date().toISOString(),
          isMine: true,
        },
      ];

      renderChatHistory(items, new Set(), onToggle);
      const toggleButton = screen.getByRole('button', { name: '테스트 질문 답변 보기' });
      fireEvent.keyDown(toggleButton, { key: 'Enter' });
      expect(onToggle).toHaveBeenCalledWith(1);
    });

    it('키보드 Space 키로 토글할 수 있다', () => {
      const onToggle = vi.fn();
      const items: AiQuestionAnswer[] = [
        {
          id: 1,
          quizId: 1,
          question: '테스트 질문',
          answer: '테스트 답변',
          status: 'completed',
          createdAt: new Date().toISOString(),
          isMine: true,
        },
      ];

      renderChatHistory(items, new Set(), onToggle);
      const toggleButton = screen.getByRole('button', { name: '테스트 질문 답변 보기' });
      fireEvent.keyDown(toggleButton, { key: ' ' });
      expect(onToggle).toHaveBeenCalledWith(1);
    });
  });

  describe('상태별 표시', () => {
    it('pending 상태이고 답변이 없을 때 타이핑 애니메이션이 표시된다', () => {
      const items: AiQuestionAnswer[] = [
        {
          id: 1,
          quizId: 1,
          question: '테스트 질문',
          answer: '',
          status: 'pending',
          createdAt: new Date().toISOString(),
          isMine: true,
        },
      ];

      renderChatHistory(items, new Set([1]));
      expect(screen.getByLabelText('답변 생성 중')).toBeInTheDocument();
    });

    it('pending 상태이고 답변이 있을 때 답변이 표시된다', () => {
      const items: AiQuestionAnswer[] = [
        {
          id: 1,
          quizId: 1,
          question: '테스트 질문',
          answer: '부분 답변',
          status: 'pending',
          createdAt: new Date().toISOString(),
          isMine: true,
        },
      ];

      renderChatHistory(items, new Set([1]));
      expect(screen.getByText('부분 답변')).toBeInTheDocument();
    });

    it('failed 상태일 때 에러 메시지가 표시된다', () => {
      const items: AiQuestionAnswer[] = [
        {
          id: 1,
          quizId: 1,
          question: '테스트 질문',
          answer: null,
          status: 'failed',
          createdAt: new Date().toISOString(),
          isMine: true,
        },
      ];

      renderChatHistory(items, new Set([1]));
      expect(
        screen.getByText('AI 응답 생성에 실패했습니다. 잠시 후 다시 시도해주세요.'),
      ).toBeInTheDocument();
    });

    it('completed 상태일 때 마크다운 렌더러가 표시된다', () => {
      const items: AiQuestionAnswer[] = [
        {
          id: 1,
          quizId: 1,
          question: '테스트 질문',
          answer: '완료된 답변',
          status: 'completed',
          createdAt: new Date().toISOString(),
          isMine: true,
        },
      ];

      renderChatHistory(items, new Set([1]));
      expect(screen.getByTestId('markdown')).toBeInTheDocument();
      expect(screen.getByText('완료된 답변')).toBeInTheDocument();
    });
  });

  describe('상태 라벨', () => {
    it('pending 상태일 때 "답변 생성 중" 라벨이 표시된다', () => {
      const items: AiQuestionAnswer[] = [
        {
          id: 1,
          quizId: 1,
          question: '테스트 질문',
          answer: '',
          status: 'pending',
          createdAt: new Date().toISOString(),
          isMine: true,
        },
      ];

      renderChatHistory(items);
      expect(screen.getByText('답변 생성 중')).toBeInTheDocument();
    });

    it('failed 상태일 때 "답변 실패" 라벨이 표시된다', () => {
      const items: AiQuestionAnswer[] = [
        {
          id: 1,
          quizId: 1,
          question: '테스트 질문',
          answer: null,
          status: 'failed',
          createdAt: new Date().toISOString(),
          isMine: true,
        },
      ];

      renderChatHistory(items);
      expect(screen.getByText('답변 실패')).toBeInTheDocument();
    });

    it('completed 상태일 때 "답변 완료" 라벨이 표시된다', () => {
      const items: AiQuestionAnswer[] = [
        {
          id: 1,
          quizId: 1,
          question: '테스트 질문',
          answer: '답변',
          status: 'completed',
          createdAt: new Date().toISOString(),
          isMine: true,
        },
      ];

      renderChatHistory(items);
      expect(screen.getByText('답변 완료')).toBeInTheDocument();
    });
  });

  describe('나의 질문 표시', () => {
    it('isMine이 true일 때 "나의 질문" 배지가 표시된다', () => {
      const items: AiQuestionAnswer[] = [
        {
          id: 1,
          quizId: 1,
          question: '테스트 질문',
          answer: '답변',
          status: 'completed',
          createdAt: new Date().toISOString(),
          isMine: true,
        },
      ];

      renderChatHistory(items);
      expect(screen.getByText('나의 질문')).toBeInTheDocument();
    });

    it('isMine이 false일 때 배지가 표시되지 않는다', () => {
      const items: AiQuestionAnswer[] = [
        {
          id: 1,
          quizId: 1,
          question: '테스트 질문',
          answer: '답변',
          status: 'completed',
          createdAt: new Date().toISOString(),
          isMine: false,
        },
      ];

      renderChatHistory(items);
      expect(screen.queryByText('나의 질문')).not.toBeInTheDocument();
    });
  });

  describe('접근성', () => {
    it('aria-expanded 속성이 올바르게 설정된다', () => {
      const items: AiQuestionAnswer[] = [
        {
          id: 1,
          quizId: 1,
          question: '테스트 질문',
          answer: '답변',
          status: 'completed',
          createdAt: new Date().toISOString(),
          isMine: true,
        },
      ];

      renderChatHistory(items, new Set([1]));
      const toggleButton = screen.getByRole('button', { name: '테스트 질문 답변 숨기기' });
      expect(toggleButton).toHaveAttribute('aria-expanded', 'true');

      cleanup();
      renderChatHistory(items, new Set());
      const toggleButton2 = screen.getByRole('button', { name: '테스트 질문 답변 보기' });
      expect(toggleButton2).toHaveAttribute('aria-expanded', 'false');
    });

    it('aria-controls 속성이 설정된다', () => {
      const items: AiQuestionAnswer[] = [
        {
          id: 1,
          quizId: 1,
          question: '테스트 질문',
          answer: '답변',
          status: 'completed',
          createdAt: new Date().toISOString(),
          isMine: true,
        },
      ];

      renderChatHistory(items);
      const toggleButton = screen.getByRole('button', { name: '테스트 질문 답변 보기' });
      expect(toggleButton).toHaveAttribute('aria-controls', 'answer-1');
    });
  });

  describe('엣지 케이스', () => {
    it('여러 질문이 있을 때 각각 독립적으로 토글된다', () => {
      const onToggle = vi.fn();
      const items: AiQuestionAnswer[] = [
        {
          id: 1,
          quizId: 1,
          question: '질문 1',
          answer: '답변 1',
          status: 'completed',
          createdAt: new Date().toISOString(),
          isMine: true,
        },
        {
          id: 2,
          quizId: 1,
          question: '질문 2',
          answer: '답변 2',
          status: 'completed',
          createdAt: new Date().toISOString(),
          isMine: true,
        },
      ];

      renderChatHistory(items, new Set([1]), onToggle);
      const question2ToggleButton = screen.getByRole('button', { name: '질문 2 답변 보기' });
      fireEvent.click(question2ToggleButton);

      expect(onToggle).toHaveBeenCalledWith(2);
    });

    it('null 답변을 처리한다', () => {
      const items: AiQuestionAnswer[] = [
        {
          id: 1,
          quizId: 1,
          question: '테스트 질문',
          answer: null,
          status: 'completed',
          createdAt: new Date().toISOString(),
          isMine: true,
        },
      ];

      renderChatHistory(items, new Set([1]));
      expect(screen.getByTestId('markdown')).toBeInTheDocument();
    });

    it('긴 질문 텍스트를 처리한다', () => {
      const longQuestion = 'a'.repeat(500);
      const items: AiQuestionAnswer[] = [
        {
          id: 1,
          quizId: 1,
          question: longQuestion,
          answer: '답변',
          status: 'completed',
          createdAt: new Date().toISOString(),
          isMine: true,
        },
      ];

      renderChatHistory(items);
      expect(screen.getByText(longQuestion)).toBeInTheDocument();
    });
  });
});

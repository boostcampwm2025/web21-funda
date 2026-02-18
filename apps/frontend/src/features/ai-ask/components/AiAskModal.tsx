import { css } from '@emotion/react';
import React, { useEffect, useMemo, useRef, useState } from 'react';

import type { CorrectAnswerType, QuizQuestion } from '@/feat/quiz/types';
import type { AiQuestionAnswer } from '@/services/aiAskService';
import { getAiQuestions } from '@/services/aiAskService';
import { BASE_URL, fetchWithAuthRetry } from '@/services/api';
import { useIsLoggedIn } from '@/store/authStore';
import { useToast } from '@/store/toastStore';

import { ChatHistorySection } from './ChatHistorySection';
import { ChatInputFooter } from './ChatInputFooter';
import { QuizInfoSection } from './QuizInfoSection';
import type { SseEvent } from './types';
import { buildQuizPreview, parseJson } from './utils';

/**
 * AI 질문 모달 컴포넌트 Props
 */
interface AiAskModalProps {
  /** 퀴즈 문제 데이터 */
  quiz: QuizQuestion;
  /** 정답 데이터 (퀴즈 타입에 따라 구조가 다름) */
  correctAnswer: CorrectAnswerType | null;
}

/**
 * AI에게 질문하고 답변을 받는 모달 컴포넌트
 *
 * @description
 * - 퀴즈 문제 정보와 정답을 표시
 * - 사용자가 질문을 입력하고 AI 응답을 스트리밍으로 받음
 * - 질문/답변 히스토리를 관리하고 표시
 *
 * @param props - 컴포넌트 props
 * @returns AI 질문 모달 JSX 요소
 */
export const AiAskModal = ({ quiz, correctAnswer }: AiAskModalProps) => {
  const [items, setItems] = useState<AiQuestionAnswer[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const currentItemIdRef = useRef<number | null>(null);
  const isLoggedIn = useIsLoggedIn();
  const { showToast } = useToast();
  const maxQuestionLength = 1000;

  const preview = useMemo(() => buildQuizPreview(quiz), [quiz]);

  useEffect(() => {
    const load = async () => {
      const fetched = await getAiQuestions(quiz.id);
      setItems(fetched);
    };

    load();
  }, [quiz.id]);

  const handleToggle = (id: number) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmed = input.trim();
    if (trimmed.length === 0) return;
    if (isStreaming) return;

    if (!isLoggedIn) {
      showToast('AI 질문을 하시려면 로그인이 필요합니다.');
      return;
    }

    if (trimmed.length > maxQuestionLength) {
      showToast(`질문은 ${maxQuestionLength}자 이하로 입력해주세요.`);
      return;
    }

    const tempId = -Date.now();
    const pendingItem: AiQuestionAnswer = {
      id: tempId,
      quizId: quiz.id,
      question: trimmed,
      answer: '',
      status: 'pending',
      createdAt: new Date().toISOString(),
      isMine: true,
    };

    currentItemIdRef.current = tempId;
    setItems(prev => [pendingItem, ...prev]);
    setExpandedIds(prev => new Set(prev).add(tempId));
    setInput('');
    setIsStreaming(true);

    try {
      await streamAiAnswer(quiz.id, trimmed, {
        onEvent: eventPayload => handleStreamEvent(eventPayload, tempId),
      });
    } catch {
      markFailed(currentItemIdRef.current);
    } finally {
      setIsStreaming(false);
    }
  };

  /**
   * SSE 스트림 이벤트를 처리하는 핸들러
   *
   * @description
   * 서버에서 전송되는 다양한 이벤트 타입을 처리:
   * - 'meta': 초기 메타데이터 (실제 ID 할당)
   * - 'chunk': 스트리밍 중인 답변 텍스트 조각
   * - 'done': 스트리밍 완료 및 최종 데이터
   * - 'error': 에러 발생 시 상태 업데이트
   *
   * @param eventPayload - SSE 이벤트 페이로드
   * @param tempId - 임시로 생성된 질문 ID (음수)
   */
  const handleStreamEvent = (eventPayload: SseEvent, tempId: number) => {
    // 'meta' 이벤트: 서버에서 실제 질문 ID를 할당할 때 전송
    // 임시 ID를 실제 ID로 교체하고 expanded 상태도 업데이트
    if (eventPayload.event === 'meta') {
      const meta = parseJson<AiQuestionAnswer>(eventPayload.data);
      if (!meta) {
        return;
      }
      replaceItem(tempId, meta);
      updateExpandedId(tempId, meta.id);
      currentItemIdRef.current = meta.id;
      return;
    }

    // 'chunk' 이벤트: 스트리밍 중인 답변의 일부 텍스트
    // 기존 답변에 새 조각을 추가하여 점진적으로 답변을 표시
    if (eventPayload.event === 'chunk') {
      const chunkPayload = parseJson<{ chunk: string }>(eventPayload.data);
      if (!chunkPayload) {
        return;
      }
      appendAnswer(chunkPayload.chunk);
      return;
    }

    // 'done' 이벤트: 스트리밍이 완료되었을 때 전송
    // 최종 답변 데이터로 아이템을 업데이트하고 상태를 'completed'로 변경
    if (eventPayload.event === 'done') {
      const donePayload = parseJson<AiQuestionAnswer>(eventPayload.data);
      if (!donePayload) {
        return;
      }
      replaceItem(currentItemIdRef.current, donePayload);
      return;
    }

    // 'error' 이벤트: 에러 발생 시 상태를 'failed'로 변경
    if (eventPayload.event === 'error') {
      markFailed(currentItemIdRef.current);
    }
  };

  const appendAnswer = (chunk: string) => {
    const targetId = currentItemIdRef.current;
    if (targetId === null) {
      return;
    }

    setItems(prev =>
      prev.map(item => {
        if (item.id !== targetId) {
          return item;
        }

        const mergedAnswer = `${item.answer ?? ''}${chunk}`;
        return { ...item, answer: mergedAnswer };
      }),
    );
  };

  const replaceItem = (targetId: number | null, next: AiQuestionAnswer) => {
    if (targetId === null) {
      return;
    }

    setItems(prev =>
      prev.map(item => {
        if (item.id !== targetId) {
          return item;
        }
        return { ...item, ...next };
      }),
    );
  };

  const markFailed = (targetId: number | null) => {
    if (targetId === null) {
      return;
    }

    setItems(prev =>
      prev.map(item => {
        if (item.id !== targetId) {
          return item;
        }
        return { ...item, status: 'failed' };
      }),
    );
  };

  const updateExpandedId = (prevId: number, nextId: number) => {
    setExpandedIds(prev => {
      if (!prev.has(prevId)) {
        return prev;
      }
      const next = new Set(prev);
      next.delete(prevId);
      next.add(nextId);
      return next;
    });
  };

  return (
    <div css={modalWrapperStyle} role="dialog" aria-label="AI 질문하기">
      <div css={containerStyle}>
        <QuizInfoSection preview={preview} correctAnswer={correctAnswer} />
        <div aria-live="polite" aria-atomic="false">
          <ChatHistorySection items={items} expandedIds={expandedIds} onToggle={handleToggle} />
        </div>
      </div>
      <ChatInputFooter
        input={input}
        onInputChange={setInput}
        onSubmit={handleSubmit}
        isStreaming={isStreaming}
        maxQuestionLength={maxQuestionLength}
      />
      <div style={{ height: '150px' }} aria-hidden="true"></div>
    </div>
  );
};

/**
 * SSE(Server-Sent Events) 스트림을 받아 이벤트 단위로 분리해 전달한다.
 *
 * @description
 * SSE 프로토콜을 사용하여 서버로부터 실시간으로 AI 답변을 스트리밍으로 받는다.
 * SSE 형식은 다음과 같다:
 * ```
 * event: meta
 * data: {"id": 123, "question": "..."}
 *
 * event: chunk
 * data: {"chunk": "답변의 일부"}
 *
 * event: done
 * data: {"id": 123, "answer": "전체 답변", "status": "completed"}
 * ```
 *
 * 파싱 로직:
 * 1. 스트림을 줄 단위로 분리
 * 2. 'event:'로 시작하는 줄에서 이벤트 타입 추출
 * 3. 'data:'로 시작하는 줄들을 모아서 하나의 데이터로 결합
 * 4. 빈 줄이 나오면 하나의 이벤트가 완성된 것으로 간주하고 핸들러 호출
 *
 * @param quizId - 퀴즈 ID
 * @param question - 사용자가 입력한 질문
 * @param handlers - 이벤트 핸들러 객체
 * @param handlers.onEvent - 각 이벤트가 파싱될 때마다 호출되는 콜백
 * @throws {Error} 스트리밍 요청이 실패하거나 응답 본문이 없을 때
 */
const streamAiAnswer = async (
  quizId: number,
  question: string,
  handlers: {
    onEvent: (event: SseEvent) => void;
  },
) => {
  // SSE 엔드포인트 URL 구성
  const url = `${BASE_URL.replace(/\/$/, '')}/quizzes/${quizId}/ai-questions/stream`;
  const response = await fetchWithAuthRetry(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ question }),
  });

  if (!response.ok || !response.body) {
    throw new Error('스트리밍 요청에 실패했습니다.');
  }

  // ReadableStream을 읽기 위한 Reader와 디코더 준비
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = ''; // 완전하지 않은 줄을 저장하는 버퍼

  let currentEvent = 'message'; // 현재 파싱 중인 이벤트 타입
  let dataLines: string[] = []; // 현재 이벤트의 데이터 줄들을 모으는 배열

  // 스트림을 끝까지 읽기
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    // 받은 바이트를 텍스트로 디코딩하고 버퍼에 추가
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    // 마지막 줄은 완전하지 않을 수 있으므로 버퍼에 보관
    buffer = lines.pop() ?? '';

    // 완전한 줄들만 처리
    for (const line of lines) {
      const trimmed = line.trimEnd();

      // 빈 줄: 하나의 이벤트가 완성된 신호
      if (trimmed.length === 0) {
        // 수집된 데이터가 있으면 이벤트로 전달
        if (dataLines.length > 0)
          handlers.onEvent({ event: currentEvent, data: dataLines.join('\n') });

        // 다음 이벤트를 위해 상태 초기화
        currentEvent = 'message';
        dataLines = [];
        continue;
      }

      // 'event:' 줄: 이벤트 타입 정의 (예: "event: chunk")
      if (trimmed.startsWith('event:')) {
        currentEvent = trimmed.replace('event:', '').trim() || 'message';
        continue;
      }

      // 'data:' 줄: 이벤트 데이터 (여러 줄일 수 있음)
      if (trimmed.startsWith('data:')) {
        // 'data:' 접두사를 제거하고 공백 제거 후 배열에 추가
        dataLines.push(trimmed.replace('data:', '').trim());
      }
    }
  }

  // 스트림이 끝났을 때 남은 데이터가 있으면 마지막 이벤트로 전달
  if (dataLines.length > 0) handlers.onEvent({ event: currentEvent, data: dataLines.join('\n') });
};

const modalWrapperStyle = css`
  height: 70vh;
  display: flex;
  flex-direction: column;
`;

const containerStyle = css`
  display: flex;
  flex-direction: column;
  gap: 16px;
  flex: 1;
  overflow-y: auto;
  padding-bottom: 20px;
`;

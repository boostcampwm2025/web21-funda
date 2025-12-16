import { css, useTheme } from '@emotion/react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { Button } from '../components/Button';
import { QuizHeader } from '../components/quiz/QuizHeader';
import {
  MultipleChoice,
  type MultipleChoiceQuestion,
} from '../components/quiz/quizType/MultipleChoice';
import { useModal } from '../contexts/ModalContext';
import type { Theme } from '../styles/theme';

// TODO: 타입 분리
type QuestionStatus = 'idle' | 'checking' | 'checked';

// TODO: FETCH
const QUESTIONS: MultipleChoiceQuestion[] = [
  {
    id: 1,
    question: '이진 탐색(Binary Search)의 시간 복잡도는?',
    options: ['O(1)', 'O(log n)', 'O(n)', 'O(n log n)', 'O(n²)'],
    correctAnswer: 1,
  },
  {
    id: 2,
    question: '다음 코드에서 빈칸에 들어갈 메서드는?',
    code: `const arr = [1, 2, 3, 4, 5];
const doubled = arr.       (x => x * 2);
console.log(doubled); // [2, 4, 6, 8, 10]`,
    options: ['filter', 'map', 'reduce', 'forEach', 'for ... of'],
    correctAnswer: 1,
    explanation: 'map() 메서드는 배열의 각 요소를 변환하여 새로운 배열을 반환합니다.',
  },
  {
    id: 3,
    question: '이진 탐색(Binary Search)의 시간 복잡도는?',
    options: ['O(1)', 'O(log n)', 'O(n)', 'O(n log n)', 'O(n²)'],
    correctAnswer: 1,
  },
];

export const Quiz = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { openModal } = useModal();
  const { unitId, stepId } = useParams<{ unitId: string; stepId: string }>();
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<number[]>(
    new Array(QUESTIONS.length).fill(-1),
  );
  const [questionStatuses, setQuestionStatuses] = useState<QuestionStatus[]>(
    new Array(QUESTIONS.length).fill('idle'),
  );
  const [currentQuestionStatus, setCurrentQuestionStatus] = useState<QuestionStatus>('idle');

  const currentQuestion = QUESTIONS[currentQuestionIndex];
  const selectedAnswer = selectedAnswers[currentQuestionIndex];
  const isAnswerSelected = selectedAnswer !== -1;
  const isLastQuestion = currentQuestionIndex === QUESTIONS.length - 1;
  // 정답을 제출한 문제만 카운트
  const completedSteps = questionStatuses.filter(status => status === 'checked').length;
  const showResult = currentQuestionStatus === 'checked';

  const handleOptionClick = (optionIndex: number) => {
    if (currentQuestionStatus !== 'idle') return;

    const newSelectedAnswers = [...selectedAnswers];
    newSelectedAnswers[currentQuestionIndex] = optionIndex;
    setSelectedAnswers(newSelectedAnswers);
  };

  const handleCheckAnswer = async () => {
    if (!isAnswerSelected || currentQuestionStatus !== 'idle') return;

    setCurrentQuestionStatus('checking');

    // 정답 확인 요청 시뮬레이션
    // TODO: 실제 요청 시간으로 대체
    await new Promise(resolve => setTimeout(resolve, 2000));

    setCurrentQuestionStatus('checked');
    // 정답 제출 완료 상태 업데이트
    const newQuestionStatuses = [...questionStatuses];
    newQuestionStatuses[currentQuestionIndex] = 'checked';
    setQuestionStatuses(newQuestionStatuses);
  };

  const handleNextQuestion = () => {
    if (isLastQuestion) {
      navigate(`/quiz/${unitId}/${stepId}/result`);
    } else {
      setCurrentQuestionIndex(prev => prev + 1);
      setCurrentQuestionStatus(questionStatuses[currentQuestionIndex + 1] || 'idle');
    }
  };

  // TODO: 내용 구현 및 분리
  const handleShowExplanation = () => {
    openModal('문제 해설', <div>{currentQuestion.explanation || '내용 준비 중입니다.'}</div>);
  };

  const handleShowReport = () => {
    openModal('문제 오류 신고', <ReportModalContent />);
  };

  const handleShowAI = () => {
    openModal('AI에게 질문하기', <div>내용 준비 중입니다.</div>);
  };

  return (
    <div css={containerStyle}>
      <QuizHeader
        currentStep={currentQuestionIndex + 1}
        totalSteps={QUESTIONS.length}
        completedSteps={completedSteps}
      />

      <main css={mainStyle}>
        <div css={quizCardContainerStyle(theme)}>
          <div css={questionHeaderStyle(theme)}>
            <h2 css={questionTitleStyle(theme)}>{currentQuestion.question}</h2>
            <button css={reportButtonStyle(theme)} onClick={handleShowReport}>
              신고
            </button>
          </div>

          <MultipleChoice
            question={currentQuestion}
            selectedAnswer={selectedAnswer}
            showResult={showResult}
            onOptionClick={handleOptionClick}
            disabled={currentQuestionStatus !== 'idle'}
          />

          <div css={actionsContainerStyle(theme)}>
            {showResult ? (
              <>
                <Button variant="secondary" onClick={handleShowExplanation} css={actionButtonStyle}>
                  해설 보기
                </Button>
                <Button variant="primary" onClick={handleNextQuestion} css={actionButtonStyle}>
                  {isLastQuestion ? '결과 보기' : '다음 문제로'}
                </Button>
                <Button variant="secondary" onClick={handleShowAI} css={actionButtonStyle}>
                  AI 질문하기
                </Button>
              </>
            ) : (
              <Button
                variant="primary"
                onClick={handleCheckAnswer}
                disabled={!isAnswerSelected || currentQuestionStatus === 'checking'}
                css={actionButtonStyle}
              >
                {currentQuestionStatus === 'checking' ? '정답 확인 중..' : '정답 확인'}
              </Button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

const containerStyle = css`
  display: flex;
  flex-direction: column;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
`;

const mainStyle = css`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  overflow-y: auto;
  background: linear-gradient(180deg, #f7f7fc 0%, #eef1ff 100%);
`;

const quizCardContainerStyle = (theme: Theme) => css`
  max-width: 45rem;
  width: 100%;
  margin: 0 auto;
  background: ${theme.colors.surface.strong};
  border-radius: ${theme.borderRadius.large};
  padding: 32px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.1);
`;

const questionHeaderStyle = (_theme: Theme) => css`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 24px;
`;

const questionTitleStyle = (theme: Theme) => css`
  font-size: ${theme.typography['24Bold'].fontSize};
  line-height: ${theme.typography['24Bold'].lineHeight};
  font-weight: ${theme.typography['24Bold'].fontWeight};
  color: ${theme.colors.text.strong};
  margin: 0;
  flex: 1;
`;

const reportButtonStyle = (theme: Theme) => css`
  padding: 8px 16px;
  background: ${theme.colors.surface.default};
  border: 1px solid ${theme.colors.border.default};
  border-radius: ${theme.borderRadius.small};
  font-size: ${theme.typography['12Medium'].fontSize};
  line-height: ${theme.typography['12Medium'].lineHeight};
  font-weight: ${theme.typography['12Medium'].fontWeight};
  color: ${theme.colors.text.default};
  cursor: pointer;
  transition: all 150ms ease;

  &:hover {
    background: ${theme.colors.surface.bold};
  }
`;

const actionsContainerStyle = (_theme: Theme) => css`
  display: flex;
  gap: 12px;
  margin-top: 24px;
`;

const actionButtonStyle = css`
  flex: 1;
`;

const ReportModalContent = () => {
  const theme = useTheme();

  return (
    <div>
      <p>신고 사유를 선택해주세요:</p>
      <div css={reportOptionsStyle}>
        <button css={reportOptionButtonStyle(theme)}>문제 오류</button>
        <button css={reportOptionButtonStyle(theme)}>정답 오류</button>
        <button css={reportOptionButtonStyle(theme)}>해설 오류</button>
        <button css={reportOptionButtonStyle(theme)}>기타</button>
      </div>
    </div>
  );
};

const reportOptionsStyle = css`
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 16px;
`;

const reportOptionButtonStyle = (theme: Theme) => css`
  padding: 12px 16px;
  background: ${theme.colors.surface.default};
  border: 1px solid ${theme.colors.border.default};
  border-radius: ${theme.borderRadius.small};
  font-size: ${theme.typography['12Medium'].fontSize};
  line-height: ${theme.typography['12Medium'].lineHeight};
  color: ${theme.colors.text.default};
  cursor: pointer;
  text-align: left;
  transition: all 150ms ease;

  &:hover {
    background: ${theme.colors.surface.bold};
    border-color: ${theme.colors.primary.main};
  }
`;

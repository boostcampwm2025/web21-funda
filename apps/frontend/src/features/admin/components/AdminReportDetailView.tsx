import { css } from '@emotion/react';

import { Button } from '@/components/Button';
import type { AdminReportDetailModel } from '@/feat/admin/hooks/useAdminReportDetail';
import { QuizRenderer } from '@/feat/quiz/components/QuizRenderer';
import type { MatchingPair } from '@/feat/quiz/types';
import { getMatchingPairs } from '@/features/quiz/utils/getMatchingPairs';
import type { Theme } from '@/styles/theme';
import { TextWithCodeStyle } from '@/utils/textParser';

type TabKey = 'edit' | 'preview';

type AdminReportDetailViewProps = {
  theme: Theme;
  reportId: number | null;
  onBack: () => void;
  detail: AdminReportDetailModel;
};

export const AdminReportDetailView = (props: AdminReportDetailViewProps) => {
  const { theme, reportId, onBack, detail } = props;
  const { data, ui, draft, actions } = detail;

  const loading = data.loading;
  const error = data.error;
  const report = data.report;
  const quiz = data.quiz;
  const quizType = data.quizType;
  const quizQuestion = data.quizQuestion;
  const correctAnswer = data.correctAnswer;
  const effectiveCorrectAnswer = data.effectiveCorrectAnswer;
  const previewQuestion = data.previewQuestion;

  const isEditing = ui.isEditing;
  const isQuizOpen = ui.isQuizOpen;
  const isEditOpen = ui.isEditOpen;
  const isReportOpen = ui.isReportOpen;
  const tab = ui.tab as TabKey;
  const isSaving = ui.isSaving;
  const hasChanges = ui.hasChanges;

  const draftQuestion = draft.draftQuestion;
  const draftExplanation = draft.draftExplanation;
  const draftOptions = draft.draftOptions;
  const draftCode = draft.draftCode;
  const draftLanguage = draft.draftLanguage;
  const draftCorrectOptionId = draft.draftCorrectOptionId;
  const draftMatchingPairs = draft.draftMatchingPairs;

  if (loading) {
    return <div css={statusStyle(theme)}>로딩 중...</div>;
  }

  if (error) {
    return <div css={statusStyle(theme)}>에러: {error}</div>;
  }

  if (!report || !quiz || !quizQuestion || !quizType) {
    return (
      <div css={statusStyle(theme)}>
        {Number.isFinite(reportId) ? '데이터가 없습니다.' : '유효한 reportId가 필요합니다.'}
      </div>
    );
  }

  return (
    <div css={pageStyle}>
      <header css={topBarStyle(theme)}>
        <div css={topLeftStyle}>
          <Button variant="secondary" type="button" onClick={onBack}>
            목록으로
          </Button>
          <div css={metaStyle(theme)}>
            <div css={metaTitleStyle(theme)}>리포트 #{report.id}</div>
            <div css={metaSubStyle(theme)}>퀴즈 #{report.quizId}</div>
          </div>
        </div>
        <div css={topRightStyle}>
          {!isEditing ? (
            <Button variant="primary" type="button" onClick={actions.startEdit}>
              수정하기
            </Button>
          ) : (
            <>
              <Button
                variant="secondary"
                type="button"
                onClick={actions.cancelEdit}
                disabled={isSaving}
              >
                취소
              </Button>
              <Button
                variant="primary"
                type="button"
                onClick={actions.save}
                disabled={isSaving || !hasChanges}
              >
                {isSaving ? '저장 중...' : '저장'}
              </Button>
            </>
          )}
        </div>
      </header>

      <section css={cardStyle(theme)} aria-label="퀴즈 상세">
        <button
          type="button"
          css={sectionHeaderButtonStyle(theme)}
          onClick={() => actions.setIsQuizOpen(prev => !prev)}
          aria-expanded={isQuizOpen}
        >
          <h2 css={sectionTitleStyle(theme)}>퀴즈 내용</h2>
          <span css={sectionToggleStyle(theme)}>{isQuizOpen ? '접기' : '펼치기'}</span>
        </button>

        {isQuizOpen && (
          <>
            <div css={questionTitleStyle(theme)}>
              Q. <TextWithCodeStyle text={quizQuestion.content.question} />
            </div>
            <div css={quizBodyStyle}>
              <QuizRenderer
                question={quizQuestion}
                selectedAnswer={
                  quizType === 'matching' ? { pairs: getMatchingPairs(correctAnswer) } : null
                }
                correctAnswer={correctAnswer}
                onAnswerChange={() => {}}
                showResult={true}
                disabled={true}
                mode="readonly"
              />
            </div>

            {quiz.explanation && (
              <div css={explanationStyle(theme)}>
                <div css={explanationLabelStyle(theme)}>해설</div>
                <div css={explanationTextStyle(theme)}>
                  <TextWithCodeStyle text={quiz.explanation} />
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {isEditing && (
        <section css={cardStyle(theme)} aria-label="퀴즈 수정">
          <button
            type="button"
            css={sectionHeaderButtonStyle(theme)}
            onClick={() => actions.setIsEditOpen(prev => !prev)}
            aria-expanded={isEditOpen}
          >
            <h2 css={sectionTitleStyle(theme)}>수정</h2>
            <span css={sectionToggleStyle(theme)}>{isEditOpen ? '접기' : '펼치기'}</span>
          </button>

          {isEditOpen && (
            <>
              <div css={editHeaderStyle}>
                <div css={tabBarStyle(theme)} role="tablist" aria-label="미리보기 탭">
                  <button
                    id="admin-reportdetail-edit-tab"
                    type="button"
                    role="tab"
                    aria-selected={tab === 'edit'}
                    aria-controls="admin-reportdetail-edit-panel"
                    onClick={actions.goEditTab}
                    css={[tabButtonStyle(theme), tab === 'edit' && tabButtonActiveStyle(theme)]}
                  >
                    편집
                  </button>
                  <button
                    id="admin-reportdetail-preview-tab"
                    type="button"
                    role="tab"
                    aria-selected={tab === 'preview'}
                    aria-controls="admin-reportdetail-preview-panel"
                    onClick={actions.goPreviewTab}
                    css={[tabButtonStyle(theme), tab === 'preview' && tabButtonActiveStyle(theme)]}
                  >
                    미리보기
                  </button>
                </div>
              </div>

              {tab === 'edit' ? (
                <div
                  css={formStyle}
                  role="tabpanel"
                  id="admin-reportdetail-edit-panel"
                  aria-labelledby="admin-reportdetail-edit-tab"
                  tabIndex={0}
                >
                  <label css={labelStyle(theme)} htmlFor="admin-quiz-question">
                    제목/문제
                  </label>
                  <textarea
                    id="admin-quiz-question"
                    css={textareaStyle(theme)}
                    value={draftQuestion}
                    onChange={event => actions.setDraftQuestion(event.target.value)}
                  />

                  {quizType !== 'matching' && (
                    <>
                      <label css={labelStyle(theme)} htmlFor="admin-quiz-correct">
                        정답
                      </label>
                      <select
                        id="admin-quiz-correct"
                        css={inputStyle(theme)}
                        value={draftCorrectOptionId}
                        onChange={event => actions.setDraftCorrectOptionId(event.target.value)}
                        disabled={draftOptions.length === 0}
                      >
                        <option value="" disabled>
                          정답 선택
                        </option>
                        {draftOptions.map(option => (
                          <option key={option.id} value={option.id}>
                            {option.id} - {option.text.trim().slice(0, 40)}
                          </option>
                        ))}
                      </select>

                      <div css={labelStyle(theme)}>선지</div>
                      <div css={optionsGridStyle}>
                        {draftOptions.map(option => (
                          <label key={option.id} css={optionRowStyle(theme)}>
                            <span css={optionIdStyle(theme)}>{option.id}</span>
                            <textarea
                              css={optionTextareaStyle(theme)}
                              value={option.text}
                              onChange={event =>
                                actions.handleChangeOptionText(option.id, event.target.value)
                              }
                            />
                          </label>
                        ))}
                      </div>
                    </>
                  )}

                  {quizType === 'matching' && (
                    <>
                      <div css={labelStyle(theme)}>정답 매칭</div>
                      <div css={noticeStyle(theme)}>
                        좌측 항목을 누른 다음 우측 항목을 눌러 정답 쌍을 만듭니다. 이미 연결된
                        항목을 누르면 연결이 해제됩니다.
                      </div>
                      <div css={matchingEditorHeaderStyle}>
                        <div css={matchingEditorCountStyle(theme)}>
                          {draftMatchingPairs.length}개 연결됨
                        </div>
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => actions.setDraftMatchingPairs([])}
                        >
                          초기화
                        </Button>
                      </div>
                      <QuizRenderer
                        question={quizQuestion}
                        selectedAnswer={{ pairs: draftMatchingPairs }}
                        correctAnswer={null}
                        onAnswerChange={answer =>
                          actions.setDraftMatchingPairs(
                            (answer as { pairs?: MatchingPair[] }).pairs ?? [],
                          )
                        }
                        showResult={false}
                        disabled={false}
                        mode="solve"
                      />
                    </>
                  )}

                  {quizType === 'code' && (
                    <>
                      <label css={labelStyle(theme)} htmlFor="admin-quiz-language">
                        언어
                      </label>
                      <input
                        id="admin-quiz-language"
                        css={inputStyle(theme)}
                        value={draftLanguage}
                        onChange={event => actions.setDraftLanguage(event.target.value)}
                        placeholder="javascript"
                      />

                      <label css={labelStyle(theme)} htmlFor="admin-quiz-code">
                        코드(내용)
                      </label>
                      <textarea
                        id="admin-quiz-code"
                        css={textareaStyle(theme)}
                        value={draftCode}
                        onChange={event => actions.setDraftCode(event.target.value)}
                      />
                    </>
                  )}

                  <label css={labelStyle(theme)} htmlFor="admin-quiz-explanation">
                    해설
                  </label>
                  <textarea
                    id="admin-quiz-explanation"
                    css={textareaStyle(theme)}
                    value={draftExplanation}
                    onChange={event => actions.setDraftExplanation(event.target.value)}
                    placeholder="(선택) 해설을 입력하세요."
                  />
                </div>
              ) : (
                <div
                  css={previewBoxStyle(theme)}
                  role="tabpanel"
                  id="admin-reportdetail-preview-panel"
                  aria-labelledby="admin-reportdetail-preview-tab"
                  tabIndex={0}
                >
                  <div css={questionTitleStyle(theme)}>
                    Q. <TextWithCodeStyle text={draftQuestion} />
                  </div>
                  {previewQuestion && (
                    <QuizRenderer
                      question={previewQuestion}
                      selectedAnswer={
                        quizType === 'matching' ? { pairs: draftMatchingPairs } : null
                      }
                      correctAnswer={effectiveCorrectAnswer}
                      onAnswerChange={() => {}}
                      showResult={true}
                      disabled={true}
                      mode="readonly"
                    />
                  )}
                  <div css={explanationStyle(theme)}>
                    <div css={explanationLabelStyle(theme)}>해설(미리보기)</div>
                    <div css={explanationTextStyle(theme)}>
                      <TextWithCodeStyle text={draftExplanation || '(해설 없음)'} />
                    </div>
                  </div>
                </div>
              )}

              <div css={editFooterStyle}>
                <div css={changeHintStyle(theme)}>
                  {hasChanges ? '변경사항이 있습니다.' : '변경사항이 없습니다.'}
                </div>
              </div>
            </>
          )}
        </section>
      )}

      <section css={cardStyle(theme)} aria-label="신고 상세">
        <button
          type="button"
          css={sectionHeaderButtonStyle(theme)}
          onClick={() => actions.setIsReportOpen(prev => !prev)}
          aria-expanded={isReportOpen}
        >
          <h2 css={sectionTitleStyle(theme)}>신고 정보</h2>
          <span css={sectionToggleStyle(theme)}>{isReportOpen ? '접기' : '펼치기'}</span>
        </button>

        {isReportOpen && (
          <div css={reportGridStyle}>
            <div css={reportItemStyle(theme)}>
              <div css={reportLabelStyle(theme)}>유저</div>
              <div css={reportValueStyle(theme)}>
                {report.userDisplayName
                  ? report.userId
                    ? `${report.userDisplayName} (#${report.userId})`
                    : report.userDisplayName
                  : '게스트'}
              </div>
            </div>
            <div css={reportItemStyle(theme)}>
              <div css={reportLabelStyle(theme)}>날짜</div>
              <div css={reportValueStyle(theme)}>
                {new Date(report.createdAt).toLocaleString('ko-KR')}
              </div>
            </div>
            <div css={reportItemStyle(theme)}>
              <div css={reportLabelStyle(theme)}>신고 내용</div>
              <div css={reportValueStyle(theme)}>{report.report_description}</div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

const pageStyle = css`
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const statusStyle = (theme: Theme) => css`
  width: 100%;
  padding: 24px;
  border-radius: ${theme.borderRadius.large};
  background: ${theme.colors.surface.strong};
  border: 1px solid ${theme.colors.border.default};
`;

const topBarStyle = (theme: Theme) => css`
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  padding: 16px;
  border-radius: ${theme.borderRadius.large};
  background: ${theme.colors.surface.strong};
  border: 1px solid ${theme.colors.border.default};
`;

const topLeftStyle = css`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const topRightStyle = css`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const metaStyle = (theme: Theme) => css`
  display: flex;
  flex-direction: column;
  gap: 2px;
  color: ${theme.colors.text.default};
`;

const metaTitleStyle = (theme: Theme) => css`
  font-weight: 800;
  color: ${theme.colors.text.strong};
`;

const metaSubStyle = (theme: Theme) => css`
  font-size: ${theme.typography['12Medium'].fontSize};
  color: ${theme.colors.text.weak};
`;

const cardStyle = (theme: Theme) => css`
  width: 100%;
  padding: 20px;
  border-radius: ${theme.borderRadius.large};
  background: ${theme.colors.surface.strong};
  border: 1px solid ${theme.colors.border.default};
`;

const sectionTitleStyle = (theme: Theme) => css`
  margin: 0 0 12px;
  font-size: ${theme.typography['16Bold'].fontSize};
  color: ${theme.colors.text.strong};
`;

const sectionHeaderButtonStyle = (theme: Theme) => css`
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  background: transparent;
  border: none;
  padding: 0;
  cursor: pointer;
  color: ${theme.colors.text.strong};
`;

const sectionToggleStyle = (theme: Theme) => css`
  font-size: ${theme.typography['12Medium'].fontSize};
  color: ${theme.colors.text.weak};
  font-weight: 800;
`;

const questionTitleStyle = (theme: Theme) => css`
  color: ${theme.colors.text.strong};
  font-weight: 800;
  line-height: 1.45;
  margin-bottom: 12px;
`;

const quizBodyStyle = css`
  width: 100%;
`;

const explanationStyle = (theme: Theme) => css`
  margin-top: 14px;
  padding: 12px 14px;
  border-radius: ${theme.borderRadius.medium};
  background: ${theme.colors.surface.default};
  border: 1px solid ${theme.colors.border.default};
`;

const explanationLabelStyle = (theme: Theme) => css`
  font-weight: 800;
  color: ${theme.colors.text.strong};
  margin-bottom: 8px;
`;

const explanationTextStyle = (theme: Theme) => css`
  color: ${theme.colors.text.default};
  line-height: 1.55;
`;

const editHeaderStyle = css`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 8px;
  margin-bottom: 12px;
`;

const tabBarStyle = (theme: Theme) => css`
  display: flex;
  gap: 8px;
  border-bottom: 1px solid ${theme.colors.border.default};
  padding-bottom: 8px;
`;

const tabButtonStyle = (theme: Theme) => css`
  border: 1px solid ${theme.colors.border.default};
  background: ${theme.colors.surface.default};
  color: ${theme.colors.text.default};
  padding: 8px 12px;
  border-radius: ${theme.borderRadius.medium};
  cursor: pointer;
  font-weight: 800;
`;

const tabButtonActiveStyle = (theme: Theme) => css`
  background: ${theme.colors.surface.strong};
  border-color: ${theme.colors.border.active};
  color: ${theme.colors.text.strong};
`;

const formStyle = css`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const labelStyle = (theme: Theme) => css`
  font-weight: 800;
  color: ${theme.colors.text.strong};
  margin-top: 10px;
`;

const textareaStyle = (theme: Theme) => css`
  width: 100%;
  min-height: 120px;
  padding: 10px 12px;
  border-radius: ${theme.borderRadius.medium};
  border: 1px solid ${theme.colors.border.default};
  background: ${theme.colors.surface.default};
  color: ${theme.colors.text.default};
  line-height: 1.5;
  resize: vertical;
`;

const inputStyle = (theme: Theme) => css`
  width: 100%;
  padding: 10px 12px;
  border-radius: ${theme.borderRadius.medium};
  border: 1px solid ${theme.colors.border.default};
  background: ${theme.colors.surface.default};
  color: ${theme.colors.text.default};
`;

const optionsGridStyle = css`
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
`;

const optionRowStyle = (theme: Theme) => css`
  display: grid;
  grid-template-columns: 44px 1fr;
  gap: 10px;
  align-items: start;
  padding: 10px;
  border-radius: ${theme.borderRadius.medium};
  border: 1px solid ${theme.colors.border.default};
  background: ${theme.colors.surface.default};
`;

const optionIdStyle = (theme: Theme) => css`
  font-weight: 900;
  color: ${theme.colors.text.strong};
  padding-top: 6px;
`;

const optionTextareaStyle = (theme: Theme) => css`
  width: 100%;
  min-height: 80px;
  padding: 10px 12px;
  border-radius: ${theme.borderRadius.medium};
  border: 1px solid ${theme.colors.border.default};
  background: ${theme.colors.surface.strong};
  color: ${theme.colors.text.default};
  line-height: 1.5;
  resize: vertical;
`;

const noticeStyle = (theme: Theme) => css`
  margin-top: 6px;
  padding: 10px 12px;
  border-radius: ${theme.borderRadius.medium};
  background: ${theme.colors.surface.default};
  border: 1px solid ${theme.colors.border.default};
  color: ${theme.colors.text.weak};
  font-size: ${theme.typography['12Medium'].fontSize};
  line-height: 1.55;
`;

const matchingEditorHeaderStyle = css`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin: 10px 0 10px;
`;

const matchingEditorCountStyle = (theme: Theme) => css`
  font-weight: 800;
  color: ${theme.colors.text.weak};
`;

const previewBoxStyle = (theme: Theme) => css`
  padding: 14px;
  border-radius: ${theme.borderRadius.large};
  background: ${theme.colors.surface.default};
  border: 1px solid ${theme.colors.border.default};
`;

const editFooterStyle = css`
  margin-top: 10px;
  display: flex;
  justify-content: flex-end;
`;

const changeHintStyle = (theme: Theme) => css`
  font-weight: 800;
  color: ${theme.colors.text.weak};
`;

const reportGridStyle = css`
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
`;

const reportItemStyle = (theme: Theme) => css`
  padding: 12px 14px;
  border-radius: ${theme.borderRadius.medium};
  background: ${theme.colors.surface.default};
  border: 1px solid ${theme.colors.border.default};
`;

const reportLabelStyle = (theme: Theme) => css`
  font-weight: 900;
  color: ${theme.colors.text.strong};
  margin-bottom: 6px;
`;

const reportValueStyle = (theme: Theme) => css`
  color: ${theme.colors.text.default};
  line-height: 1.55;
`;

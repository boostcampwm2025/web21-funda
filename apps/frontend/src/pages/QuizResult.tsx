import { useEffect, useState } from 'react';

import { PointEffect } from '@/components/result/PointEffect';
import { QuizResultContent } from '@/components/result/QuizResultContent';

// TODO: FETCH
const RESULT_DATA = {
  xp: 50,
  successRate: 70,
  timeTaken: '1:40',
} as const;

export const QuizResult = () => {
  const [showPointEffect, setShowPointEffect] = useState(true);
  const [isLogin] = useState(false); // TODO: 실제 로그인 상태로 대체
  const [isFirstToday] = useState(true); // TODO: 실제 오늘 첫 문제 여부로 대체

  useEffect(() => {
    if (showPointEffect) {
      const timer = setTimeout(() => {
        setShowPointEffect(false);
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [showPointEffect]);

  if (showPointEffect) return <PointEffect points={RESULT_DATA.xp} />;

  return (
    <QuizResultContent resultData={RESULT_DATA} isLogin={isLogin} isFirstToday={isFirstToday} />
  );
};

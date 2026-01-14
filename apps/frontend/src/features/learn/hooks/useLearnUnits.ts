import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { UnitType } from '@/feat/learn/types';
import { useStorage } from '@/hooks/useStorage';
import { fieldService } from '@/services/fieldService';
import { useAuthStore } from '@/store/authStore';

/**
 * Learn 페이지에서 사용할 유닛/스텝 데이터와 스크롤 상태를 관리합니다.
 */
export const useLearnUnits = () => {
  const { uiState, solvedStepHistory, updateUIState } = useStorage();
  const [field, setField] = useState('');
  const [units, setUnits] = useState<UnitType[]>([]);
  const [activeUnitId, setActiveUnitId] = useState<number | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const headerRef = useRef<HTMLDivElement | null>(null);
  const unitRefs = useRef(new Map<number, HTMLElement>());
  const isLoggedIn = useAuthStore(state => state.authStatus === 'authenticated');

  /**
   * 현재 활성화된 유닛을 반환합니다.
   * @returns 활성 유닛 또는 첫 번째 유닛
   */
  const activeUnit = useMemo(
    () => units.find(unit => unit.id === activeUnitId) ?? units[0],
    [activeUnitId, units],
  );

  /**
   * solvedStepHistory에 포함된 step을 완료 상태로 표시합니다. (비로그인 상태인 경우에만)
   * @param units 완료 여부를 반영할 유닛 목록
   * @returns 완료 표시가 반영된 유닛 목록
   */
  const markSolvedSteps = (units: UnitType[]) => {
    const solvedSet = new Set(solvedStepHistory);
    return units.map(unit => ({
      ...unit,
      steps: unit.steps.map(step =>
        solvedSet.has(step.id) ? { ...step, isCompleted: true } : step,
      ),
    }));
  };

  /**
   * 체크포인트 스텝이 이전 스텝들을 모두 완료했을 때 잠금 해제되도록 처리합니다.
   * (로그인/비로그인 모두 사용 가능지만, 현재는 비로그인 상태에서만 호출)
   * @param units 잠금 해제 여부를 반영할 유닛 목록
   * @returns 체크포인트 잠금 상태가 반영된 유닛 목록
   */
  const unlockCheckpoints = (units: UnitType[]) =>
    units.map(unit => ({
      ...unit,
      steps: unit.steps.map(step => {
        if (step.isCheckpoint && step.isLocked) {
          const isUnlockable = unit.steps
            .filter(s => s.orderIndex < step.orderIndex)
            .every(s => s.isCompleted);
          return isUnlockable ? { ...step, isLocked: false } : step;
        } else {
          return step;
        }
      }),
    }));

  /**
   * field_slug를 기준으로 유닛/스텝 데이터를 요청하고 상태로 매핑합니다.
   */
  useEffect(() => {
    const fieldSlug = uiState.last_viewed?.field_slug;
    let isMounted = true;

    const fetchUnits = async () => {
      try {
        const data = await fieldService.getFieldUnits(fieldSlug);
        if (!isMounted) return;

        setField(data.field.name);
        setUnits(
          isLoggedIn ? (data.units ?? []) : unlockCheckpoints(markSolvedSteps(data.units ?? [])),
        );
        setActiveUnitId(data.units[0]?.id ?? null);
      } catch (error) {
        console.error('Failed to fetch units:', error);
      }
    };

    fetchUnits();

    return () => {
      isMounted = false;
    };
  }, [isLoggedIn]);

  /**
   * 스크롤 위치를 기준으로 활성 유닛을 계산합니다.
   */
  useEffect(() => {
    const root = scrollContainerRef.current;
    if (!root || units.length === 0) return;
    let ticking = false;

    const updateActiveUnit = () => {
      const headerHeight = headerRef.current?.offsetHeight ?? 0;
      const scrollTop = root.scrollTop + headerHeight + 1;
      let nextId = units[0]?.id ?? null;

      unitRefs.current.forEach((element, id) => {
        if (element.offsetTop <= scrollTop) {
          nextId = id;
        }
      });

      setActiveUnitId(prev => (prev === nextId ? prev : nextId));
    };

    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(() => {
          updateActiveUnit();
          ticking = false;
        });
      }
    };

    updateActiveUnit();
    root.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      root.removeEventListener('scroll', onScroll);
    };
  }, [units]);

  /**
   * 저장된 unit_id가 있으면 해당 유닛 위치로 초기 스크롤합니다.
   */
  useEffect(() => {
    // TODO: 추후 last_solved_unit_id에서 해당하는 field의 유닛 ID로 스크롤 되도록 수정 필요
    const root = scrollContainerRef.current;
    if (!root || units.length === 0) return;

    const fallbackUnitId = units[0]?.id;
    if (!fallbackUnitId) return;

    const lastViewedUnitId =
      uiState.last_viewed.unit_id <= 1 ? fallbackUnitId : uiState.last_viewed.unit_id;

    updateUIState({
      last_viewed: {
        ...uiState.last_viewed,
        unit_id: lastViewedUnitId,
      },
    });

    const targetUnitId = lastViewedUnitId;
    if (targetUnitId <= 1) return;

    const element = unitRefs.current.get(targetUnitId);
    if (!element) return;

    const headerHeight = headerRef.current?.offsetHeight ?? 0;
    root.scrollTo({
      top: Math.max(0, element.offsetTop - headerHeight),
    });
  }, [uiState.last_viewed.unit_id, units]);

  /**
   * 유닛 DOM을 등록하는 ref 콜백을 생성합니다.
   * @param unitId 유닛 ID
   */
  const registerUnitRef = useCallback(
    (unitId: number) => (element: HTMLElement | null) => {
      if (!element) {
        unitRefs.current.delete(unitId);
        return;
      }
      unitRefs.current.set(unitId, element);
    },
    [],
  );

  return {
    field,
    units,
    activeUnit,
    scrollContainerRef,
    headerRef,
    registerUnitRef,
  };
};

import { BadRequestException } from '@nestjs/common';
import type { DataSource, Repository } from 'typeorm';

import { RedisService } from '../common/redis/redis.service';
import { SolveLog } from '../progress/entities/solve-log.entity';
import { StepAttemptStatus, UserStepAttempt } from '../progress/entities/user-step-attempt.entity';
import { Field } from '../roadmap/entities/field.entity';
import { User } from '../users/entities/user.entity';

import { ProfileCharacter } from './entities/profile-character.entity';
import { UserFollow } from './entities/user-follow.entity';
import { UserProfileCharacter } from './entities/user-profile-character.entity';
import { getLast7Days } from './utils/date.utils';
import { ProfileService } from './profile.service';

describe('ProfileService', () => {
  let service: ProfileService;
  let dataSource: Partial<DataSource>;
  let userRepository: Partial<Repository<User>>;
  let solveLogRepository: Partial<Repository<SolveLog>>;
  let stepAttemptRepository: Partial<Repository<UserStepAttempt>>;
  let fieldRepository: Partial<Repository<Field>>;
  let followRepository: Partial<Repository<UserFollow>>;
  let profileCharacterRepository: Partial<Repository<ProfileCharacter>>;
  let userProfileCharacterRepository: Partial<Repository<UserProfileCharacter>>;
  let redisService: Partial<RedisService>;
  let userFindOneMock: jest.Mock;
  let followCountMock: jest.Mock;
  let followFindOneMock: jest.Mock;
  let followSaveMock: jest.Mock;
  let followCreateMock: jest.Mock;
  let followFindMock: jest.Mock;
  let fieldFindMock: jest.Mock;
  let solveLogQueryBuilderMock: {
    select: jest.Mock;
    addSelect: jest.Mock;
    where: jest.Mock;
    andWhere: jest.Mock;
    innerJoin: jest.Mock;
    groupBy: jest.Mock;
    addGroupBy: jest.Mock;
    orderBy: jest.Mock;
    addOrderBy: jest.Mock;
    getRawOne: jest.Mock;
    getRawMany: jest.Mock;
  };
  let stepAttemptQueryBuilderMock: {
    select: jest.Mock;
    addSelect: jest.Mock;
    where: jest.Mock;
    andWhere: jest.Mock;
    groupBy: jest.Mock;
    orderBy: jest.Mock;
    getRawOne: jest.Mock;
    getRawMany: jest.Mock;
  };

  beforeEach(() => {
    userFindOneMock = jest.fn();
    followCountMock = jest.fn();
    followFindOneMock = jest.fn();
    followSaveMock = jest.fn();
    followCreateMock = jest.fn(entity => entity);
    followFindMock = jest.fn();
    fieldFindMock = jest.fn();

    solveLogQueryBuilderMock = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      addGroupBy: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getRawOne: jest.fn(),
      getRawMany: jest.fn(),
    };
    stepAttemptQueryBuilderMock = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getRawOne: jest.fn(),
      getRawMany: jest.fn(),
    };

    userRepository = {
      findOne: userFindOneMock,
    };

    solveLogRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(solveLogQueryBuilderMock),
    };
    stepAttemptRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(stepAttemptQueryBuilderMock),
    };
    fieldRepository = {
      find: fieldFindMock,
    };

    followRepository = {
      countBy: followCountMock,
      findOne: followFindOneMock,
      findOneBy: followFindOneMock,
      save: followSaveMock,
      create: followCreateMock,
      find: followFindMock,
    };

    dataSource = {};
    profileCharacterRepository = {};
    userProfileCharacterRepository = {};
    redisService = { get: jest.fn(), set: jest.fn() };

    service = new ProfileService(
      dataSource as DataSource,
      userRepository as Repository<User>,
      solveLogRepository as Repository<SolveLog>,
      stepAttemptRepository as Repository<UserStepAttempt>,
      fieldRepository as Repository<Field>,
      followRepository as Repository<UserFollow>,
      profileCharacterRepository as Repository<ProfileCharacter>,
      userProfileCharacterRepository as Repository<UserProfileCharacter>,
      redisService as RedisService,
    );
  });

  it('프로필 요약에 통계와 팔로우 수를 포함한다', async () => {
    userFindOneMock.mockResolvedValue({
      id: 1,
      displayName: '펀다',
      profileImageUrl: null,
      experience: 120,
      diamondCount: 42,
      currentStreak: 7,
      currentTier: { id: 2, name: 'BRONZE', orderIndex: 1 },
    } as User);

    followCountMock.mockImplementation(async where => {
      if (where?.followingId === 1) {
        return 3;
      }

      if (where?.followerId === 1) {
        return 5;
      }

      return 0;
    });

    solveLogQueryBuilderMock.getRawOne.mockResolvedValue({
      solvedCount: '12',
    });
    stepAttemptQueryBuilderMock.getRawOne.mockResolvedValue({
      totalSeconds: '3600',
    });

    const result = await service.getProfileSummary(1);

    expect(result.followerCount).toBe(3);
    expect(result.followingCount).toBe(5);
    expect(result.totalStudyTimeSeconds).toBe(3600);
    expect(result.totalStudyTimeMinutes).toBe(60);
    expect(result.solvedQuizzesCount).toBe(12);
    expect(result.diamondCount).toBe(42);
    expect(result.tier?.name).toBe('BRONZE');
    expect(stepAttemptQueryBuilderMock.andWhere).toHaveBeenCalledWith(
      'stepAttempt.status = :status',
      { status: StepAttemptStatus.COMPLETED },
    );
  });

  it('팔로우 요청 시 관계를 저장한다', async () => {
    userFindOneMock.mockResolvedValue({ id: 2 } as User);
    followFindOneMock.mockResolvedValue(null);
    followCountMock.mockResolvedValueOnce(4);
    followCountMock.mockResolvedValueOnce(6);

    const result = await service.followUser(2, 1);

    expect(result.isFollowing).toBe(true);
    expect(result.targetFollowerCount).toBe(4);
    expect(result.followerFollowingCount).toBe(6);
    expect(followCreateMock).toHaveBeenCalledWith({ followerId: 1, followingId: 2 });
    expect(followSaveMock).toHaveBeenCalled();
  });

  it('자기 자신을 팔로우하려 하면 실패한다', async () => {
    await expect(service.followUser(1, 1)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('팔로워 목록 조회 시 캐릭터 프로필 이미지를 우선 적용한다', async () => {
    userFindOneMock.mockResolvedValue({ id: 1 } as User);
    followFindMock.mockResolvedValue([
      {
        follower: {
          id: 10,
          displayName: '리더',
          profileImageUrl: 'https://example.com/avatar.png',
          profileCharacter: { imageUrl: 'https://example.com/character.png' },
          experience: 200,
          currentTier: { id: 1, name: 'BRONZE', orderIndex: 1 },
        },
      } as UserFollow,
    ]);

    const result = await service.getFollowers(1);

    expect(followFindMock).toHaveBeenCalledWith({
      where: { followingId: 1 },
      relations: { follower: { currentTier: true, profileCharacter: true } },
    });
    expect(result).toHaveLength(1);
    const [firstFollower] = result;
    if (!firstFollower) {
      throw new Error('팔로워 목록이 비어 있습니다.');
    }
    expect(firstFollower.userId).toBe(10);
    expect(firstFollower.profileImageUrl).toBe('https://example.com/character.png');
    expect(firstFollower.tier?.name).toBe('BRONZE');
  });

  it('팔로잉 목록 조회 시 캐릭터 프로필이 없으면 기본 이미지를 사용한다', async () => {
    userFindOneMock.mockResolvedValue({ id: 1 } as User);
    followFindMock.mockResolvedValue([
      {
        following: {
          id: 20,
          displayName: '팔로잉유저',
          profileImageUrl: 'https://example.com/fallback.png',
          profileCharacter: null,
          experience: 190,
          currentTier: { id: 2, name: 'SILVER', orderIndex: 2 },
        },
      } as UserFollow,
    ]);

    const result = await service.getFollowing(1);

    expect(followFindMock).toHaveBeenCalledWith({
      where: { followerId: 1 },
      relations: { following: { currentTier: true, profileCharacter: true } },
    });
    expect(result).toHaveLength(1);
    const [firstFollowing] = result;
    if (!firstFollowing) {
      throw new Error('팔로잉 목록이 비어 있습니다.');
    }
    expect(firstFollowing.userId).toBe(20);
    expect(firstFollowing.profileImageUrl).toBe('https://example.com/fallback.png');
    expect(firstFollowing.tier?.name).toBe('SILVER');
  });

  it('팔로워 목록을 영문 우선 이름순으로 정렬한다', async () => {
    userFindOneMock.mockResolvedValue({ id: 1 } as User);
    followFindMock.mockResolvedValue([
      {
        follower: {
          id: 11,
          displayName: '앨리스',
          profileImageUrl: null,
          experience: 300,
          currentTier: { id: 1, name: 'BRONZE', orderIndex: 1 },
        },
      } as UserFollow,
      {
        follower: {
          id: 12,
          displayName: 'Zoe',
          profileImageUrl: null,
          experience: 220,
          currentTier: { id: 2, name: 'SILVER', orderIndex: 2 },
        },
      } as UserFollow,
      {
        follower: {
          id: 13,
          displayName: 'Adam',
          profileImageUrl: null,
          experience: 180,
          currentTier: { id: 3, name: 'GOLD', orderIndex: 3 },
        },
      } as UserFollow,
    ]);

    const result = await service.getFollowers(1);

    expect(result.map(user => user.displayName)).toEqual(['Adam', 'Zoe', '앨리스']);
  });

  describe('getDailyStats', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('최근 7일간의 날짜별 학습 시간과 문제 풀이 수를 반환한다', async () => {
      // 고정된 날짜로 설정: 2024년 1월 15일 (월요일)
      jest.setSystemTime(new Date('2024-01-15T12:00:00Z'));

      userFindOneMock.mockResolvedValue({ id: 1 } as User);

      const mockDates = getLast7Days('UTC');

      // stepAttemptRepository 모킹 (학습 시간)
      stepAttemptQueryBuilderMock.getRawMany.mockResolvedValue([
        { date: mockDates[1], seconds: '3600' }, // 1시간
        { date: mockDates[3], seconds: '7200' }, // 2시간
        { date: mockDates[5], seconds: '1800' }, // 30분
      ]);

      // solveLogRepository 모킹 (문제 풀이 수)
      solveLogQueryBuilderMock.getRawMany.mockResolvedValue([
        { date: mockDates[1], count: '5' },
        { date: mockDates[3], count: '10' },
        { date: mockDates[5], count: '3' },
      ]);

      const result = await service.getDailyStats(1, 'UTC');

      expect(result.dailyData).toHaveLength(7);
      const day0 = result.dailyData[0];
      if (!day0) {
        throw new Error('day0 is undefined');
      }
      expect(day0.date).toBe(mockDates[0]);
      expect(day0.studySeconds).toBe(0);
      expect(day0.solvedCount).toBe(0);

      const day1 = result.dailyData[1];
      if (!day1) {
        throw new Error('day1 is undefined');
      }
      expect(day1.date).toBe(mockDates[1]);
      expect(day1.studySeconds).toBe(3600);
      expect(day1.solvedCount).toBe(5);

      const day2 = result.dailyData[2];
      if (!day2) {
        throw new Error('day2 is undefined');
      }
      expect(day2.date).toBe(mockDates[2]);
      expect(day2.studySeconds).toBe(0);
      expect(day2.solvedCount).toBe(0);

      const day3 = result.dailyData[3];
      if (!day3) {
        throw new Error('day3 is undefined');
      }
      expect(day3.date).toBe(mockDates[3]);
      expect(day3.studySeconds).toBe(7200);
      expect(day3.solvedCount).toBe(10);

      // 최대 학습 시간 확인
      expect(result.periodMaxSeconds).toBe(7200);

      // 평균 학습 시간 확인 (3600 + 7200 + 1800) / 7 = 1800
      expect(result.periodAverageSeconds).toBe(1800);
    });

    it('데이터가 없는 경우 모든 날짜가 0으로 채워진다', async () => {
      // 고정된 날짜로 설정: 2024년 1월 15일 (월요일)
      jest.setSystemTime(new Date('2024-01-15T12:00:00Z'));

      userFindOneMock.mockResolvedValue({ id: 1 } as User);

      stepAttemptQueryBuilderMock.getRawMany.mockResolvedValue([]);
      solveLogQueryBuilderMock.getRawMany.mockResolvedValue([]);

      const result = await service.getDailyStats(1, 'UTC');

      expect(result.dailyData).toHaveLength(7);
      result.dailyData.forEach(day => {
        expect(day.studySeconds).toBe(0);
        expect(day.solvedCount).toBe(0);
      });

      expect(result.periodMaxSeconds).toBe(0);
      expect(result.periodAverageSeconds).toBe(0);
    });

    it('타임존이 다른 경우 날짜 범위가 해당 타임존 기준으로 계산된다', async () => {
      // UTC 기준 2024-01-15 12:00:00, KST 기준 2024-01-15 21:00:00
      jest.setSystemTime(new Date('2024-01-15T12:00:00Z'));

      userFindOneMock.mockResolvedValue({ id: 1 } as User);

      const mockDates = getLast7Days('Asia/Seoul');

      stepAttemptQueryBuilderMock.getRawMany.mockResolvedValue([
        { date: mockDates[0], seconds: '600' },
      ]);
      solveLogQueryBuilderMock.getRawMany.mockResolvedValue([{ date: mockDates[0], count: '2' }]);

      const result = await service.getDailyStats(1, 'Asia/Seoul');

      expect(result.dailyData[0]?.date).toBe(mockDates[0]);
      expect(result.dailyData[0]?.studySeconds).toBe(600);
      expect(result.dailyData[0]?.solvedCount).toBe(2);
    });
  });

  describe('getFieldDailyStats', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('최근 7일간 필드별 문제 풀이 수를 반환한다', async () => {
      // 고정된 시간 설정 (2024년 1월 15일 오후 3시 KST 기준)
      jest.setSystemTime(new Date('2024-01-15T06:00:00.000Z')); // UTC 06:00 = KST 15:00

      userFindOneMock.mockResolvedValue({ id: 1 } as User);

      const mockDates = getLast7Days('Asia/Seoul');

      fieldFindMock.mockResolvedValue([
        { id: 1, name: '프론트엔드', slug: 'frontend' },
        { id: 2, name: '백엔드', slug: 'backend' },
      ]);

      solveLogQueryBuilderMock.getRawMany.mockResolvedValue([
        {
          fieldId: 1,
          fieldName: '프론트엔드',
          fieldSlug: 'frontend',
          date: mockDates[1],
          solvedCount: '5',
        },
        {
          fieldId: 1,
          fieldName: '프론트엔드',
          fieldSlug: 'frontend',
          date: mockDates[3],
          solvedCount: '10',
        },
        {
          fieldId: 2,
          fieldName: '백엔드',
          fieldSlug: 'backend',
          date: mockDates[2],
          solvedCount: '3',
        },
      ]);

      const result = await service.getFieldDailyStats(1, 'Asia/Seoul');

      expect(result.fields).toHaveLength(2);

      const frontendField = result.fields.find(f => f.fieldId === 1);
      expect(frontendField).toBeDefined();
      if (!frontendField) {
        throw new Error('frontendField is undefined');
      }
      expect(frontendField.fieldName).toBe('프론트엔드');
      expect(frontendField.dailyData).toHaveLength(7);
      const frontendDay1 = frontendField.dailyData[1];
      const frontendDay3 = frontendField.dailyData[3];
      if (!frontendDay1 || !frontendDay3) {
        throw new Error('frontend daily data is undefined');
      }
      expect(frontendDay1.solvedCount).toBe(5);
      expect(frontendDay3.solvedCount).toBe(10);
      expect(frontendField.totalSolvedCount).toBe(15);
      expect(frontendField.periodMaxSolvedCount).toBe(10);
      expect(frontendField.periodAverageSolvedCount).toBe(2); // 15 / 7 = 2.14... -> 2

      const backendField = result.fields.find(f => f.fieldId === 2);
      expect(backendField).toBeDefined();
      if (!backendField) {
        throw new Error('backendField is undefined');
      }
      expect(backendField.fieldName).toBe('백엔드');
      expect(backendField.dailyData).toHaveLength(7);
      const backendDay2 = backendField.dailyData[2];
      if (!backendDay2) {
        throw new Error('backend daily data is undefined');
      }
      expect(backendDay2.solvedCount).toBe(3);
      expect(backendField.totalSolvedCount).toBe(3);
      expect(backendField.periodMaxSolvedCount).toBe(3);
      expect(backendField.periodAverageSolvedCount).toBe(0); // 3 / 7 = 0.42... -> 0
    });

    it('필드별 데이터가 없는 경우 모든 날짜가 0으로 채워진다', async () => {
      // 고정된 시간 설정 (2024년 1월 15일 오후 3시 KST 기준)
      jest.setSystemTime(new Date('2024-01-15T06:00:00.000Z')); // UTC 06:00 = KST 15:00

      userFindOneMock.mockResolvedValue({ id: 1 } as User);

      fieldFindMock.mockResolvedValue([{ id: 1, name: '프론트엔드', slug: 'frontend' }]);

      solveLogQueryBuilderMock.getRawMany.mockResolvedValue([]);

      const result = await service.getFieldDailyStats(1, 'Asia/Seoul');

      expect(result.fields).toHaveLength(1);
      const field = result.fields[0];
      if (!field) {
        throw new Error('field is undefined');
      }
      expect(field.dailyData).toHaveLength(7);
      field.dailyData.forEach(day => {
        expect(day.solvedCount).toBe(0);
      });
      expect(field.totalSolvedCount).toBe(0);
      expect(field.periodMaxSolvedCount).toBe(0);
      expect(field.periodAverageSolvedCount).toBe(0);
    });

    it('타임존이 다른 경우 필드별 날짜가 해당 타임존 기준으로 계산된다', async () => {
      // UTC 기준 2024-01-15 12:00:00, KST 기준 2024-01-15 21:00:00
      jest.setSystemTime(new Date('2024-01-15T12:00:00Z'));

      userFindOneMock.mockResolvedValue({ id: 1 } as User);

      const mockDates = getLast7Days('Asia/Seoul');

      fieldFindMock.mockResolvedValue([{ id: 1, name: '프론트엔드', slug: 'frontend' }]);

      solveLogQueryBuilderMock.getRawMany.mockResolvedValue([
        {
          fieldId: 1,
          fieldName: '프론트엔드',
          fieldSlug: 'frontend',
          date: mockDates[0],
          solvedCount: '4',
        },
      ]);

      const result = await service.getFieldDailyStats(1, 'Asia/Seoul');

      const frontendField = result.fields.find(f => f.fieldId === 1);
      if (!frontendField) {
        throw new Error('frontendField is undefined');
      }
      expect(frontendField.dailyData[0]?.date).toBe(mockDates[0]);
      expect(frontendField.dailyData[0]?.solvedCount).toBe(4);
    });
  });
});

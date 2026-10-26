import { describe, expect, it } from 'vitest';
import type { Activity, AppState } from '@/types';
import { createInitialState, DEMO_USER_ID } from '@/data/seed';
import { addMinutes, localISO } from '@/lib/date';
import {
  canApply,
  canApprove,
  canCheckin,
  canEditActivity,
  canLeaveActivity,
  canOrganizerAct,
  canReview,
  canWithdrawApplication,
  isFull,
  memberCount,
  remainingSeats,
  validateActivityDraft,
  viewStatusFor,
} from '@/domain/rules';
import { EMPTY_ACTIVITY_DRAFT } from '@/types';

function fresh(): AppState {
  return createInitialState();
}

function activityById(state: AppState, id: string): Activity {
  const activity = state.activities.find((a) => a.id === id);
  if (!activity) throw new Error(`missing activity ${id}`);
  return activity;
}

function futureDraft(): typeof EMPTY_ACTIVITY_DRAFT {
  const start = addMinutes(new Date(), 60 * 24);
  const date = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(
    start.getDate(),
  ).padStart(2, '0')}`;
  return {
    ...EMPTY_ACTIVITY_DRAFT,
    title: '周末东湖 City Walk',
    category: 'citywalk',
    date,
    startTime: '10:00',
    meetingPoint: '东湖绿道湖光序曲驿站',
    maxParticipants: 6,
    feeMode: 'aa',
    budgetMin: 20,
    budgetMax: 50,
    description: '沿东湖绿道走 5 公里，节奏很慢，适合第一次参加活动的人。',
    tags: ['轻松', '拍照'],
  };
}

describe('参与人数与容量规则', () => {
  it('人数 = 组织者 + 已通过成员，剩余名额正确', () => {
    const state = fresh();
    const activity = activityById(state, 'a_donghu_sunset');
    expect(memberCount(state, activity.id)).toBe(3);
    expect(remainingSeats(state, activity)).toBe(activity.maxParticipants - 3);
    expect(isFull(state, activity)).toBe(false);
  });

  it('人数达到上限即满员', () => {
    const state = fresh();
    const activity = activityById(state, 'a_donghu_sunset');
    const max = activity.maxParticipants;
    for (let i = memberCount(state, activity.id); i < max; i += 1) {
      state.members.push({
        id: `extra_${i}`,
        activityId: activity.id,
        userId: `ghost_${i}`,
        role: 'participant',
        attendance: 'pending',
        joinedAt: localISO(),
      });
    }
    expect(isFull(state, activity)).toBe(true);
    expect(canApply(state, activity, 'u_shasha')).toMatchObject({ allowed: false, code: 'full' });
    expect(canApprove(state, activity).allowed).toBe(false);
  });
});

describe('申请资格 canApply', () => {
  it('普通用户可以申请有名额且未开始的活动', () => {
    const state = fresh();
    const activity = activityById(state, 'a_donghu_sunset');
    expect(canApply(state, activity, 'u_shasha').allowed).toBe(true);
  });

  it('组织者 / 成员不能申请自己的活动', () => {
    const state = fresh();
    const activity = activityById(state, 'a_boardgame_night');
    expect(canApply(state, activity, DEMO_USER_ID)).toMatchObject({ allowed: false, code: 'self' });
  });

  it('已提交待审核申请的用户重复申请被拦截', () => {
    const state = fresh();
    const activity = activityById(state, 'a_donghu_sunset');
    expect(canApply(state, activity, DEMO_USER_ID)).toMatchObject({
      allowed: false,
      code: 'duplicated',
    });
  });

  it('已取消 / 已结束 / 进行中的活动都不可申请', () => {
    const state = fresh();
    expect(canApply(state, activityById(state, 'a_light_show'), 'u_chenyu')).toMatchObject({
      allowed: false,
      code: 'cancelled',
    });
    expect(canApply(state, activityById(state, 'a_hanyangzao'), 'u_tangtang')).toMatchObject({
      allowed: false,
      code: 'ended',
    });
    expect(canApply(state, activityById(state, 'a_eastlake_ride'), 'u_shasha')).toMatchObject({
      allowed: false,
      code: 'started',
    });
  });

  it('开始时间已过（准备中但时间过期）不可申请', () => {
    const state = fresh();
    const activity = { ...activityById(state, 'a_donghu_sunset') };
    activity.startAt = localISO(addMinutes(new Date(), -30));
    expect(canApply(state, activity, 'u_shasha')).toMatchObject({ allowed: false, code: 'started' });
  });
});

describe('状态机与组织者操作', () => {
  it('准备中 → 进行中 → 待评价 合法；跳过进行中不合法', () => {
    const state = fresh();
    const activity = activityById(state, 'a_boardgame_night');
    expect(canOrganizerAct(activity, DEMO_USER_ID, 'start').allowed).toBe(true);
    expect(canOrganizerAct(activity, DEMO_USER_ID, 'finish').allowed).toBe(false);

    const ongoing = { ...activity, status: 'ongoing' as const };
    expect(canOrganizerAct(ongoing, DEMO_USER_ID, 'start').allowed).toBe(false);
    expect(canOrganizerAct(ongoing, DEMO_USER_ID, 'finish').allowed).toBe(true);
  });

  it('非组织者不能推进状态', () => {
    const state = fresh();
    const activity = activityById(state, 'a_boardgame_night');
    expect(canOrganizerAct(activity, 'u_chenyu', 'start')).toMatchObject({ allowed: false });
  });

  it('已取消的活动不能再次取消；已结束的不能取消', () => {
    const state = fresh();
    expect(canOrganizerAct(activityById(state, 'a_light_show'), 'u_ahu', 'cancel').allowed).toBe(false);
    expect(canOrganizerAct(activityById(state, 'a_hanyangzao'), 'u_chenyu', 'cancel').allowed).toBe(false);
  });
});

describe('评价 / 签到 / 退出规则', () => {
  it('未结束的活动不能评价', () => {
    const state = fresh();
    expect(canReview(state, activityById(state, 'a_boardgame_night'), DEMO_USER_ID)).toMatchObject({
      allowed: false,
    });
  });

  it('待评价活动里，未评价成员可以评价，已评价成员不能重复评价', () => {
    const state = fresh();
    const activity = activityById(state, 'a_escape_room');
    expect(canReview(state, activity, DEMO_USER_ID).allowed).toBe(true);
    expect(canReview(state, activity, 'u_ahu')).toMatchObject({ allowed: false });
  });

  it('已评价过的活动不能再评价', () => {
    const state = fresh();
    expect(canReview(state, activityById(state, 'a_hanyangzao'), DEMO_USER_ID)).toMatchObject({
      allowed: false,
    });
  });

  it('只有进行中的活动可以签到，重复签到被拦截', () => {
    const state = fresh();
    const activity = activityById(state, 'a_eastlake_ride');
    expect(canCheckin(state, activity, DEMO_USER_ID).allowed).toBe(true);
    state.checkins.push({
      id: 'c1',
      activityId: activity.id,
      userId: DEMO_USER_ID,
      status: 'checked_in',
      checkedAt: localISO(),
    });
    expect(canCheckin(state, activity, DEMO_USER_ID)).toMatchObject({ allowed: false });
  });

  it('组织者不能退出自己的活动；普通成员可以退出', () => {
    const state = fresh();
    const activity = activityById(state, 'a_boardgame_night');
    expect(canLeaveActivity(state, activity, DEMO_USER_ID)).toMatchObject({ allowed: false });
    const other = activityById(state, 'a_donghu_sunset');
    expect(canLeaveActivity(state, other, 'u_tangtang').allowed).toBe(true);
  });

  it('只有待审核的申请可以被撤回', () => {
    const state = fresh();
    const activity = activityById(state, 'a_donghu_sunset');
    const pending = state.applications.find(
      (a) => a.activityId === activity.id && a.userId === DEMO_USER_ID,
    )!;
    expect(canWithdrawApplication(activity, pending).allowed).toBe(true);
    expect(canWithdrawApplication(activity, { ...pending, status: 'approved' })).toMatchObject({
      allowed: false,
    });
  });
  it('组织者在准备中可以修改集合信息，活动开始后不行', () => {
    const state = fresh();
    const preparing = activityById(state, 'a_boardgame_night');
    expect(canEditActivity(preparing, DEMO_USER_ID).allowed).toBe(true);
    expect(canEditActivity({ ...preparing, status: 'ongoing' }, DEMO_USER_ID)).toMatchObject({
      allowed: false,
    });
    expect(canEditActivity(preparing, 'u_chenyu')).toMatchObject({ allowed: false });
  });
});

describe('展示状态折算', () => {
  it('待评价活动按当前用户是否已评价折算为已完成', () => {
    const state = fresh();
    const activity = activityById(state, 'a_escape_room');
    expect(viewStatusFor(state, activity, DEMO_USER_ID)).toBe('awaiting_review');
    state.reviews.push({
      id: 'r1',
      activityId: activity.id,
      reviewerId: DEMO_USER_ID,
      rating: 5,
      tags: [],
      comment: '',
      createdAt: localISO(),
    });
    expect(viewStatusFor(state, activity, DEMO_USER_ID)).toBe('completed');
  });
});

describe('创建活动表单校验', () => {
  it('合法草稿没有错误', () => {
    expect(validateActivityDraft(futureDraft(), new Date())).toEqual({});
  });

  it('过去时间被拦截', () => {
    const draft = { ...futureDraft(), date: '2020-01-01', startTime: '10:00' };
    expect(validateActivityDraft(draft, new Date()).startAt).toBeTruthy();
  });

  it('标题、人数、介绍、预算、标签都有边界校验', () => {
    const draft = futureDraft();
    const errors = validateActivityDraft(
      {
        ...draft,
        title: '短',
        maxParticipants: 1,
        description: '太短',
        budgetMin: 100,
        budgetMax: 10,
        tags: ['1', '2', '3', '4', '5', '6'],
      },
      new Date(),
    );
    expect(errors.title).toBeTruthy();
    expect(errors.maxParticipants).toBeTruthy();
    expect(errors.description).toBeTruthy();
    expect(errors.budgetMax).toBeTruthy();
    expect(errors.tags).toBeTruthy();
  });

  it('人数上限超过 30 被拦截', () => {
    expect(validateActivityDraft({ ...futureDraft(), maxParticipants: 31 }, new Date()).maxParticipants)
      .toBeTruthy();
  });

  it('必填项缺失被拦截', () => {
    const errors = validateActivityDraft(EMPTY_ACTIVITY_DRAFT, new Date());
    expect(errors.title).toBeTruthy();
    expect(errors.category).toBeTruthy();
    expect(errors.date).toBeTruthy();
    expect(errors.meetingPoint).toBeTruthy();
    expect(errors.feeMode).toBeTruthy();
  });
});

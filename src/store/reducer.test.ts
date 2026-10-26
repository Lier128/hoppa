import { describe, expect, it } from 'vitest';
import type { AnalyticsEvent, AppState, Application, Review } from '@/types';
import { createInitialState, DEMO_USER_ID } from '@/data/seed';
import { localISO } from '@/lib/date';
import { reducer } from './reducer';

function fresh(): AppState {
  return createInitialState();
}

function event(name: string): AnalyticsEvent {
  return { id: `evt_${name}`, name, props: {}, createdAt: localISO() };
}

function makeApplication(overrides: Partial<Application> = {}): Application {
  const now = localISO();
  return {
    id: 'app_test_1',
    activityId: 'a_donghu_sunset',
    userId: 'u_shasha',
    message: '想参加',
    status: 'pending',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('申请相关 reducer', () => {
  it('同一用户同一活动的有效申请不会被重复创建', () => {
    const state = fresh();
    const before = state.applications.length;
    const duplicated = makeApplication({ userId: DEMO_USER_ID });
    const next = reducer(state, { type: 'application/create', application: duplicated });
    expect(next.applications.length).toBe(before);
  });

  it('通过申请会生成成员并把用户加入群聊成员列表', () => {
    const state = fresh();
    const application = state.applications.find(
      (a) => a.activityId === 'a_boardgame_night' && a.status === 'pending',
    )!;
    const beforeMembers = state.members.length;
    const next = reducer(state, {
      type: 'application/decide',
      applicationId: application.id,
      decision: 'approved',
      at: localISO(),
      member: {
        id: 'member_new',
        activityId: application.activityId,
        userId: application.userId,
        role: 'participant',
        attendance: 'pending',
        joinedAt: localISO(),
      },
    });
    expect(next.applications.find((a) => a.id === application.id)?.status).toBe('approved');
    expect(next.members.length).toBe(beforeMembers + 1);
    const conversation = next.conversations.find((c) => c.activityId === 'a_boardgame_night')!;
    expect(conversation.memberIds).toContain(application.userId);
  });

  it('拒绝申请不会生成成员', () => {
    const state = fresh();
    const application = state.applications.find(
      (a) => a.activityId === 'a_boardgame_night' && a.status === 'pending',
    )!;
    const next = reducer(state, {
      type: 'application/decide',
      applicationId: application.id,
      decision: 'rejected',
      at: localISO(),
    });
    expect(next.applications.find((a) => a.id === application.id)?.status).toBe('rejected');
    expect(next.members.length).toBe(state.members.length);
  });

  it('已处理的申请不会被再次审核', () => {
    const state = fresh();
    const application = state.applications.find(
      (a) => a.activityId === 'a_boardgame_night' && a.status === 'approved',
    )!;
    const next = reducer(state, {
      type: 'application/decide',
      applicationId: application.id,
      decision: 'rejected',
      at: localISO(),
      member: {
        id: 'member_x',
        activityId: application.activityId,
        userId: application.userId,
        role: 'participant',
        attendance: 'pending',
        joinedAt: localISO(),
      },
    });
    expect(next.applications.find((a) => a.id === application.id)?.status).toBe('approved');
  });

  it('撤回申请把状态改为 withdrawn', () => {
    const state = fresh();
    const pending = state.applications.find((a) => a.status === 'pending')!;
    const next = reducer(state, {
      type: 'application/withdraw',
      applicationId: pending.id,
      at: localISO(),
    });
    expect(next.applications.find((a) => a.id === pending.id)?.status).toBe('withdrawn');
  });
});

describe('评价相关 reducer', () => {
  const review = (overrides: Partial<Review> = {}): Review => ({
    id: 'review_test_1',
    activityId: 'a_escape_room',
    reviewerId: DEMO_USER_ID,
    rating: 5,
    tags: ['组织清晰'],
    comment: '不错',
    createdAt: localISO(),
    ...overrides,
  });

  it('同一用户对同一活动只保留一条评价', () => {
    const state = fresh();
    const once = reducer(state, { type: 'review/create', review: review() });
    const twice = reducer(once, {
      type: 'review/create',
      review: review({ id: 'review_test_2', rating: 3 }),
    });
    expect(twice.reviews.filter((r) => r.activityId === 'a_escape_room')).toHaveLength(
      state.reviews.filter((r) => r.activityId === 'a_escape_room').length + 1,
    );
    expect(twice.reviews.find((r) => r.id === 'review_test_2')).toBeUndefined();
  });

  it('所有成员都评价后活动状态自动变为已结束', () => {
    const state = fresh();
    const members = state.members
      .filter((m) => m.activityId === 'a_escape_room')
      .map((m) => m.userId);
    let next = state;
    members.forEach((userId, index) => {
      next = reducer(next, {
        type: 'review/create',
        review: review({ id: `review_all_${index}`, reviewerId: userId }),
      });
    });
    expect(next.activities.find((a) => a.id === 'a_escape_room')?.status).toBe('completed');
  });
});

describe('签到 / 群聊 / 互动', () => {
  it('签到会写签到记录并把成员 attendance 改成 checked_in，重复签到无效', () => {
    const state = fresh();
    const checkin = {
      id: 'checkin_1',
      activityId: 'a_eastlake_ride',
      userId: DEMO_USER_ID,
      status: 'checked_in' as const,
      checkedAt: localISO(),
    };
    const once = reducer(state, { type: 'checkin/create', checkin });
    expect(once.checkins.some((c) => c.id === checkin.id)).toBe(true);
    expect(
      once.members.find((m) => m.activityId === 'a_eastlake_ride' && m.userId === DEMO_USER_ID)
        ?.attendance,
    ).toBe('checked_in');

    const twice = reducer(once, { type: 'checkin/create', checkin: { ...checkin, id: 'checkin_2' } });
    expect(twice.checkins.filter((c) => c.activityId === 'a_eastlake_ride')).toHaveLength(1);
  });

  it('发送消息会追加消息并刷新会话时间', () => {
    const state = fresh();
    const conversation = state.conversations.find((c) => c.activityId === 'a_boardgame_night')!;
    const message = {
      id: 'msg_test_1',
      conversationId: conversation.id,
      senderId: DEMO_USER_ID,
      content: '周五见',
      createdAt: localISO(),
    };
    const next = reducer(state, { type: 'message/send', message });
    expect(next.messages.some((m) => m.id === message.id)).toBe(true);
    expect(next.conversations.find((c) => c.id === conversation.id)?.updatedAt).toBe(
      message.createdAt,
    );
  });

  it('点赞会累加、再次点击会撤销', () => {
    const state = fresh();
    // post_2 当前演示用户还没有点过赞，避免与 seed 里的互动记录冲突
    const post = state.posts.find((p) => p.id === 'post_2')!;
    const interaction = {
      id: 'interaction_test_1',
      userId: DEMO_USER_ID,
      targetType: 'post' as const,
      targetId: post.id,
      actionType: 'like' as const,
      createdAt: localISO(),
    };
    const liked = reducer(state, { type: 'interaction/toggle', interaction });
    expect(liked.posts.find((p) => p.id === post.id)?.likeCount).toBe(post.likeCount + 1);
    const unliked = reducer(liked, { type: 'interaction/toggle', interaction });
    expect(unliked.posts.find((p) => p.id === post.id)?.likeCount).toBe(post.likeCount);
  });

  it('退出活动会移除成员、把申请标记为 left、并从群聊移除', () => {
    const state = fresh();
    const next = reducer(state, {
      type: 'member/leave',
      activityId: 'a_donghu_sunset',
      userId: 'u_tangtang',
      at: localISO(),
    });
    expect(next.members.some((m) => m.activityId === 'a_donghu_sunset' && m.userId === 'u_tangtang'))
      .toBe(false);
    const conversation = next.conversations.find((c) => c.activityId === 'a_donghu_sunset')!;
    expect(conversation.memberIds).not.toContain('u_tangtang');
  });
});

describe('全局状态', () => {
  it('切换身份只接受存在的用户', () => {
    const state = fresh();
    expect(reducer(state, { type: 'switchUser', userId: 'u_chenyu' }).currentUserId).toBe('u_chenyu');
    expect(reducer(state, { type: 'switchUser', userId: 'nobody' }).currentUserId).toBe(
      state.currentUserId,
    );
  });

  it('资料修改只影响当前用户', () => {
    const state = fresh();
    const next = reducer(state, { type: 'profile/update', patch: { nickname: '新的昵称' } });
    expect(next.users.find((u) => u.id === DEMO_USER_ID)?.nickname).toBe('新的昵称');
    expect(next.users.find((u) => u.id === 'u_chenyu')?.nickname).toBe('陈屿');
  });

  it('埋点事件只保留最近 300 条', () => {
    let state = fresh();
    for (let i = 0; i < 320; i += 1) {
      state = reducer(state, { type: 'event/track', event: event(`e_${i}`) });
    }
    expect(state.events).toHaveLength(300);
    expect(state.events.at(-1)?.name).toBe('e_319');
  });

  it('组织者更新集合地点会写入活动字段', () => {
    const state = fresh();
    const next = reducer(state, {
      type: 'activity/update',
      activityId: 'a_boardgame_night',
      patch: { meetingPoint: '街道口「骰子与猫」桌游店（二楼前台）' },
    });
    expect(next.activities.find((a) => a.id === 'a_boardgame_night')?.meetingPoint).toContain('二楼前台');
  });

  it('重置会恢复演示数据', () => {
    const state = fresh();
    state.currentUserId = 'u_shasha';
    const next = reducer(state, { type: 'reset', state: createInitialState() });
    expect(next.currentUserId).toBe(DEMO_USER_ID);
    expect(next.activities).toHaveLength(state.activities.length);
  });
});

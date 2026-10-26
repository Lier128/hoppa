import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useApp } from '@/store/AppStore';
import { memberCount, viewStatusFor } from '@/domain/rules';
import { Avatar, Button, EmptyState, PageHead, StatusTag, useToast } from '@/components/ui';
import {
  ArrowLeft,
  Clock,
  ExternalLink,
  Info,
  MapPin,
  MessageSquare,
  SendHorizontal,
  ShieldCheck,
  Users,
} from '@/components/ui/icons';
import { clock, dateTimeRange, isSameDay, monthDay, toDate } from '@/lib/date';
import { cx } from '@/lib/format';
import styles from './Chat.module.css';

/** 同一次会话里同一个群聊只上报一次 open，避免 StrictMode / 重渲染把埋点刷爆 */
const openedChats = new Set<string>();

function messageTime(iso: string, now: Date): string {
  const d = toDate(iso);
  if (Number.isNaN(d.getTime())) return '';
  if (isSameDay(d, now)) return clock(d);
  return `${monthDay(d)} ${clock(d)}`;
}

/**
 * 活动群聊
 *
 * - 路由参数是会话 id，先用 state.conversations 反查，再校验活动存在；
 * - 非成员可以看历史消息，但输入框禁用（store.sendMessage 同样会拦截）；
 * - Enter 发送、Shift+Enter 换行；空消息不发送；发送后 store 已持久化并上报 message_send；
 * - 进入页面上报 group_chat_open（本会话内去重）。
 */
export default function ChatPage() {
  const { state, now, currentUser, userById, activityById, messagesOf, sendMessage, track } = useApp();
  const { id } = useParams<{ id: string }>();
  const toast = useToast();

  const conversation = state.conversations.find((c) => c.id === id);
  const activity = conversation ? activityById(conversation.activityId) : undefined;
  const messages = conversation ? messagesOf(conversation.id) : [];

  const [text, setText] = useState('');
  const bodyRef = useRef<HTMLDivElement>(null);

  // 新消息 / 打开另一个群聊后滚到底部
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length, conversation?.id]);

  const conversationId = conversation?.id;
  const conversationActivityId = conversation?.activityId;
  useEffect(() => {
    if (!conversationId || !conversationActivityId) return;
    const key = `${currentUser.id}:${conversationId}`;
    if (openedChats.has(key)) return;
    openedChats.add(key);
    track('group_chat_open', { activity_id: conversationActivityId });
  }, [conversationId, conversationActivityId, currentUser.id, track]);

  if (!conversation || !activity) {
    return (
      <div className={cx('page', styles.page)}>
        <PageHead title="活动群聊" backTo="/messages" />
        <EmptyState
          icon={<MessageSquare size={22} />}
          title="找不到这个群聊"
          description="链接可能已经失效，或者演示数据被重置过。回到消息列表看看还有哪些活动群聊。"
          action={
            <Button to="/messages" iconLeft={<ArrowLeft size={16} />}>
              返回消息列表
            </Button>
          }
        />
      </div>
    );
  }

  const isMember = conversation.memberIds.includes(currentUser.id);
  const status = viewStatusFor(state, activity, currentUser.id);
  const totalMembers = memberCount(state, activity.id);
  // 安全中心只对「准备中 / 进行中」的成员开放；已结束 / 已取消时不展示入口
  const showSafety = isMember && (activity.status === 'preparing' || activity.status === 'ongoing');

  const handleSend = () => {
    if (!isMember) {
      toast.error('你不是本活动成员，无法发言');
      return;
    }
    const result = sendMessage(conversation.id, text);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setText('');
  };

  return (
    <div className={cx('page', styles.page)}>
      <div className="chat">
        <div className="chat__head">
          <Link to="/messages" className="icon-btn" aria-label="返回消息列表" title="返回消息列表">
            <ArrowLeft size={19} />
          </Link>

          <div className={styles.headMain}>
            <div className={styles.titleRow}>
              <h1 className={styles.title} title={activity.title}>
                {activity.title}
              </h1>
              <StatusTag status={status} />
            </div>
            <div className={styles.metaRow}>
              <span title={dateTimeRange(activity.startAt, activity.endAt)}>
                <Clock size={12} aria-hidden="true" />
                {dateTimeRange(activity.startAt, activity.endAt)}
              </span>
              <span title={activity.meetingPoint}>
                <MapPin size={12} aria-hidden="true" />
                {activity.meetingPoint}
              </span>
              <span>
                <Users size={12} aria-hidden="true" />
                {totalMembers}/{activity.maxParticipants} 人
              </span>
            </div>
          </div>

          <div className={styles.headActions}>
            <Button
              size="sm"
              variant="secondary"
              to={`/activity/${activity.id}`}
              iconLeft={<ExternalLink size={14} />}
            >
              详情
            </Button>
            {showSafety && (
              <Button
                size="sm"
                variant="ghost"
                to={`/safety/${activity.id}`}
                iconLeft={<ShieldCheck size={14} />}
                aria-label="打开安全中心"
              >
                安全
              </Button>
            )}
          </div>
        </div>

        <div className="chat__body" ref={bodyRef} aria-label="群聊消息列表">
          {messages.length === 0 ? (
            <div className={styles.emptyChat}>
              <p className={styles.emptyTitle}>
                <MessageSquare size={16} aria-hidden="true" />
                还没有人发言
              </p>
              <p className={styles.emptyDesc}>
                可以先打个招呼，或者在这里确认集合信息。下面是这次活动的关键信息：
              </p>
              <div className="meta-list">
                <div className="meta-item">
                  <Clock className="meta-item__icon" size={15} aria-hidden="true" />
                  <span className="meta-item__label">时间</span>
                  <span className="meta-item__value">
                    {dateTimeRange(activity.startAt, activity.endAt)}
                  </span>
                </div>
                <div className="meta-item">
                  <MapPin className="meta-item__icon" size={15} aria-hidden="true" />
                  <span className="meta-item__label">集合地点</span>
                  <span className="meta-item__value">{activity.meetingPoint}</span>
                </div>
                <div className="meta-item">
                  <Users className="meta-item__icon" size={15} aria-hidden="true" />
                  <span className="meta-item__label">成员</span>
                  <span className="meta-item__value">
                    {totalMembers}/{activity.maxParticipants} 人
                  </span>
                </div>
                {activity.notes && (
                  <div className="meta-item">
                    <Info className="meta-item__icon" size={15} aria-hidden="true" />
                    <span className="meta-item__label">活动规则</span>
                    <span className="meta-item__value">{activity.notes}</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            messages.map((message) => {
              const sender = userById(message.senderId);
              const mine = message.senderId === currentUser.id;
              return (
                <div key={message.id} className={cx('msg', mine && 'msg--mine')}>
                  <Avatar user={sender} size="sm" />
                  <div className={cx(styles.msgMain, mine && styles.mine)}>
                    <span className={styles.sender}>
                      {mine ? `${currentUser.nickname}（我）` : sender?.nickname ?? '成员'}
                    </span>
                    <div className={cx('msg__bubble', styles.bubble)}>{message.content}</div>
                    <span className="msg__meta">{messageTime(message.createdAt, now)}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {!isMember && (
          <div className={styles.lockNotice} role="status">
            <Info size={15} aria-hidden="true" />
            <span>
              你不是本活动成员，无法发言。只有组织者和已通过申请的成员可以加入群聊。
              <Link to={`/activity/${activity.id}`}>去活动详情看看</Link>
            </span>
          </div>
        )}

        <div className={styles.composerArea}>
          {text.length > 400 && <div className={styles.counter}>{text.length}/500</div>}
          <div className="chat__composer">
            <textarea
              className={styles.composerInput}
              value={text}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
                event.preventDefault();
                handleSend();
              }}
              rows={1}
              maxLength={500}
              disabled={!isMember}
              aria-label="输入群聊消息"
              placeholder={
                isMember ? '发消息…（Enter 发送，Shift+Enter 换行）' : '你不是本活动成员，无法发言'
              }
            />
            <Button
              onClick={handleSend}
              disabled={!isMember || !text.trim()}
              iconLeft={<SendHorizontal size={16} />}
              className={styles.sendBtn}
            >
              发送
            </Button>
          </div>
          <p className={styles.composerHint}>
            {isMember
              ? 'Enter 发送 · Shift+Enter 换行 · 消息仅保存在本机（演示环境）'
              : '仅活动成员可以发言'}
          </p>
        </div>
      </div>
    </div>
  );
}

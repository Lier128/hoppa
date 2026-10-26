import { Link } from 'react-router-dom';
import { useApp } from '@/store/AppStore';
import { memberCount, viewStatusFor } from '@/domain/rules';
import { CATEGORY_META } from '@/types';
import { fromNowLabel } from '@/lib/date';
import { Button, CategoryIcon, EmptyState, PageHead, StatusTag } from '@/components/ui';
import { ArrowRight, Info, MessagesSquare, Users } from '@/components/ui/icons';
import styles from './Messages.module.css';

/**
 * 消息 / 会话列表
 *
 * - 数据来自 store.myConversations（已按 updatedAt 倒序），不在页面里二次排序；
 * - 每个会话展示：活动标题、状态、最后一条消息摘要、相对时间、成员数；
 * - 不伪造未读数：本演示没有已读回执，所以不展示未读角标；
 * - 点击进入 /messages/:convId。
 */
export default function MessagesPage() {
  const { state, currentUser, activityById, messagesOf, userById, myConversations } = useApp();

  // 只展示能反查到活动的会话；数据被重置或损坏时安静跳过异常行
  const rows = myConversations.flatMap((conversation) => {
    const activity = activityById(conversation.activityId);
    if (!activity) return [];
    const messages = messagesOf(conversation.id);
    return [{ conversation, activity, last: messages.at(-1), messageCount: messages.length }];
  });

  return (
    <div className="page">
      <PageHead
        title="消息"
        sub={
          rows.length > 0
            ? `共 ${rows.length} 个活动群聊 · 按最近消息时间排序`
            : '申请通过后，活动会自动生成一个群聊'
        }
        actions={
          <Button to="/buddy" variant="secondary" size="sm" iconRight={<ArrowRight size={15} />}>
            去逛活动
          </Button>
        }
      />

      <div className={`notice notice--info ${styles.demoNotice}`}>
        <Info size={16} aria-hidden="true" />
        <span>
          群聊为本地模拟：消息只保存在这台设备的浏览器里，不会发送到任何外部即时通讯服务，也不会同步给其他人。
        </span>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<MessagesSquare size={22} />}
          title="还没有进行中的群聊"
          description="当你通过一个活动的申请（或自己发起活动）后，群聊会自动出现在这里。先去挑一个感兴趣的活动吧。"
          action={
            <Button to="/buddy" iconRight={<ArrowRight size={16} />}>
              去看看活动
            </Button>
          }
        />
      ) : (
        <ul className={styles.list} aria-label="活动群聊列表">
          {rows.map(({ conversation, activity, last, messageCount }) => {
            const lastSender = last ? userById(last.senderId) : undefined;
            const status = viewStatusFor(state, activity, currentUser.id);
            const categoryMeta = CATEGORY_META[activity.category];
            return (
              <li key={conversation.id}>
                <Link to={`/messages/${conversation.id}`} className={`card card--hover ${styles.item}`}>
                  <span
                    className={styles.thumb}
                    style={{ background: categoryMeta.gradient }}
                    aria-hidden="true"
                  >
                    <CategoryIcon category={activity.category} size={22} />
                  </span>

                  <span className={styles.main}>
                    <span className={styles.titleRow}>
                      <span className={styles.title}>{activity.title}</span>
                      <StatusTag status={status} />
                    </span>
                    <span className={styles.preview}>
                      {last ? (
                        <>
                          <strong>
                            {lastSender?.id === currentUser.id ? '我' : lastSender?.nickname ?? '成员'}
                          </strong>
                          ：{last.content.replace(/\s+/g, ' ')}
                        </>
                      ) : (
                        <span className={styles.previewEmpty}>暂无消息，进去打个招呼吧</span>
                      )}
                    </span>
                  </span>

                  <span className={styles.side}>
                    <span className={styles.time}>{last ? fromNowLabel(last.createdAt) : ''}</span>
                    <span className={styles.members}>
                      <Users size={12} aria-hidden="true" />
                      {memberCount(state, activity.id)} 人
                    </span>
                    <span className={styles.count}>{messageCount} 条</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

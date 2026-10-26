import { useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { ActivityMember, Application } from '@/types';
import {
  ACTIVITY_STATUS_META,
  APPLICATION_STATUS_META,
  CATEGORY_META,
  FEE_MODE_META,
  TRANSPORT_META,
} from '@/types';
import {
  canApprove,
  canEditActivity,
  canOrganizerAct,
  memberCount,
  remainingSeats,
} from '@/domain/rules';
import { useApp } from '@/store/AppStore';
import {
  Avatar,
  Button,
  ConfirmDialog,
  Cover,
  EmptyState,
  Field,
  Modal,
  PageHead,
  StatusTag,
  Tag,
  TextArea,
  TextInput,
  useToast,
} from '@/components/ui';
import {
  CalendarDays,
  Check,
  ClipboardList,
  Clock,
  Crown,
  Info,
  MapPin,
  Pencil,
  Play,
  Route,
  ShieldAlert,
  Square,
  TriangleAlert,
  Users,
  Wallet,
} from '@/components/ui/icons';
import { budgetLabel, cx, percent } from '@/lib/format';
import { dateTimeRange, durationLabel, fromNowLabel, isFuture } from '@/lib/date';
import styles from './ManageActivity.module.css';

type DialogState =
  | { kind: 'start-early' }
  | { kind: 'finish' }
  | { kind: 'cancel' }
  | { kind: 'update-info' }
  | { kind: 'reject'; applicationId: string; name: string }
  | null;

const ATTENDANCE_META: Record<
  ActivityMember['attendance'],
  { label: string; tone: 'green' | 'slate' | 'amber' }
> = {
  pending: { label: '待签到', tone: 'slate' },
  checked_in: { label: '已签到', tone: 'green' },
  absent: { label: '缺席', tone: 'amber' },
};

export default function ManageActivityPage() {
  const { id } = useParams<{ id: string }>();
  const {
    state,
    now,
    currentUser,
    activityById,
    applicationsOf,
    membersOf,
    userById,
    decideApplication,
    startActivity,
    finishActivity,
    cancelActivity,
    updateActivity,
    conversationOf,
  } = useApp();
  const toast = useToast();

  const [dialog, setDialog] = useState<DialogState>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editMeeting, setEditMeeting] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editError, setEditError] = useState<string | undefined>(undefined);
  // 编辑弹窗与确认框不叠放（两个 Modal 同时开关会互相抢 body 滚动锁），
  // 确认框取消时凭这个标记把编辑弹窗恢复出来。
  const editSavedRef = useRef(false);

  const activity = id ? activityById(id) : undefined;

  if (!activity) {
    return (
      <div className="page">
        <PageHead title="活动管理" sub="活动不存在或已被重置" backTo="/my" />
        <EmptyState
          icon={<ClipboardList size={22} aria-hidden="true" />}
          title="找不到这个活动"
          description="链接可能已经失效，或者演示数据被重置。回到「我的活动」重新选择吧。"
          action={
            <Button to="/my" variant="secondary">
              返回我的活动
            </Button>
          }
        />
      </div>
    );
  }

  if (activity.organizerId !== currentUser.id) {
    return (
      <div className="page">
        <PageHead title="活动管理" sub={activity.title} backTo={`/activity/${activity.id}`} />
        <EmptyState
          icon={<ShieldAlert size={22} aria-hidden="true" />}
          title="没有管理权限"
          description={`只有活动组织者可以进入管理页。当前演示身份是「${currentUser.nickname}」，可以在右下角「演示工具」里切换到组织者身份后再试。`}
          action={
            <div className={styles.emptyActions}>
              <Button to={`/activity/${activity.id}`} variant="secondary">
                返回活动详情
              </Button>
              <Button to="/my">去我的活动</Button>
            </div>
          }
        />
      </div>
    );
  }

  const members = [...membersOf(activity.id)].sort((a, b) =>
    a.role === b.role ? 0 : a.role === 'organizer' ? -1 : 1,
  );
  const applications = applicationsOf(activity.id);
  const pendingApps = applications.filter((item) => item.status === 'pending');
  const processedApps = applications.filter((item) => item.status !== 'pending');
  const conversation = conversationOf(activity.id);
  const count = memberCount(state, activity.id);
  const remaining = remainingSeats(state, activity);
  const checkedInCount = state.checkins.filter((item) => item.activityId === activity.id).length;
  const canProcessApplications = activity.status === 'preparing';
  const earlyStart = isFuture(activity.startAt, now);

  const startCheck = canOrganizerAct(activity, currentUser.id, 'start');
  const finishCheck = canOrganizerAct(activity, currentUser.id, 'finish');
  const cancelCheck = canOrganizerAct(activity, currentUser.id, 'cancel');
  const editCheck = canEditActivity(activity, currentUser.id);

  const durationMinutes = Math.max(
    0,
    Math.round((new Date(activity.endAt).getTime() - new Date(activity.startAt).getTime()) / 60000),
  );

  const runStart = () => {
    const result = startActivity(activity.id);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(
      earlyStart ? '演示模式：活动已提前开始' : '活动已开始，成员可以签到与进入群聊',
    );
    setDialog(null);
  };

  const runFinish = () => {
    const result = finishActivity(activity.id);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success('活动已结束，进入待评价');
    setDialog(null);
  };

  const runCancel = () => {
    const result = cancelActivity(activity.id);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success('活动已取消，成员会在「我的活动」看到取消状态');
    setDialog(null);
  };

  const handleStart = () => {
    if (!startCheck.allowed) {
      toast.error(startCheck.reason ?? '当前无法开始活动');
      return;
    }
    if (earlyStart) {
      setDialog({ kind: 'start-early' });
      return;
    }
    runStart();
  };

  const handleFinish = () => {
    if (!finishCheck.allowed) {
      toast.error(finishCheck.reason ?? '当前无法结束活动');
      return;
    }
    setDialog({ kind: 'finish' });
  };

  const handleCancel = () => {
    if (!cancelCheck.allowed) {
      toast.error(cancelCheck.reason ?? '当前无法取消活动');
      return;
    }
    setDialog({ kind: 'cancel' });
  };

  const handleApprove = (application: Application) => {
    if (!canProcessApplications) {
      toast.error('活动已开始或已结束，不能再处理申请');
      return;
    }
    const check = canApprove(state, activity);
    if (!check.allowed) {
      toast.error(check.reason ?? '名额已满，无法通过申请');
      return;
    }
    const result = decideApplication(application.id, 'approved');
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`已通过 ${userById(application.userId)?.nickname ?? '该用户'} 的申请`);
  };

  const openEdit = () => {
    if (!editCheck.allowed) {
      toast.error(editCheck.reason ?? '当前无法修改集合信息');
      return;
    }
    setEditMeeting(activity.meetingPoint);
    setEditNotes(activity.notes);
    setEditError(undefined);
    setEditOpen(true);
  };

  const submitEdit = () => {
    const meetingPoint = editMeeting.trim();
    if (meetingPoint.length < 2) {
      setEditError('集合地点至少 2 个字符');
      return;
    }
    setEditError(undefined);
    // 先关闭编辑弹窗再开确认框：两个 Modal 同时挂载会互相覆盖 body overflow
    editSavedRef.current = false;
    setEditOpen(false);
    setDialog({ kind: 'update-info' });
  };

  const runUpdateInfo = () => {
    const result = updateActivity(activity.id, {
      meetingPoint: editMeeting.trim(),
      notes: editNotes.trim(),
    });
    if (!result.ok) {
      toast.error(result.error);
      if (result.field === 'meetingPoint') setEditError(result.error);
      return;
    }
    editSavedRef.current = true;
    toast.success('集合信息已更新，并已在群聊通知成员（演示）');
  };

  const closeUpdateConfirm = () => {
    const saved = editSavedRef.current;
    editSavedRef.current = false;
    setDialog(null);
    // 取消确认时把编辑内容原样恢复，避免用户白填
    if (!saved) setEditOpen(true);
  };

  const handleRejectConfirm = () => {
    if (dialog?.kind !== 'reject') return;
    const result = decideApplication(dialog.applicationId, 'rejected');
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`已拒绝 ${dialog.name} 的申请`);
    setDialog(null);
  };

  const renderApplication = (application: Application) => {
    const applicant = userById(application.userId);
    const statusMeta = APPLICATION_STATUS_META[application.status];
    const pending = application.status === 'pending';
    return (
      <div
        key={application.id}
        className={cx(styles.appRow, pending && canProcessApplications && styles.appRowPending)}
      >
        <Avatar user={applicant} size="sm" />
        <div className={styles.appBody}>
          <div className={styles.appHead}>
            <span className={styles.appName}>{applicant?.nickname ?? '演示用户'}</span>
            <Tag tone={statusMeta.tone}>{statusMeta.label}</Tag>
            <span className={styles.appTime}>{fromNowLabel(application.createdAt, now)}</span>
          </div>

          {applicant && applicant.tags.length > 0 && (
            <div className={styles.appTags}>
              {applicant.tags.slice(0, 3).map((tag) => (
                <Tag key={tag} outline>
                  {tag}
                </Tag>
              ))}
            </div>
          )}

          <p className={cx(styles.appMsg, !application.message.trim() && styles.appMsgEmpty)}>
            {application.message.trim() || '申请者没有留言'}
          </p>

          {pending && canProcessApplications && (
            <div className={styles.appActions}>
              <Button size="sm" iconLeft={<Check size={14} aria-hidden="true" />} onClick={() => handleApprove(application)}>
                通过
              </Button>
              <Button
                size="sm"
                variant="danger-soft"
                onClick={() =>
                  setDialog({
                    kind: 'reject',
                    applicationId: application.id,
                    name: applicant?.nickname ?? '该用户',
                  })
                }
              >
                拒绝
              </Button>
            </div>
          )}

          {pending && !canProcessApplications && (
            <p className={styles.appHint}>活动已开始或已结束，按规则不能再处理这条申请。</p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="page">
      <PageHead
        title="活动管理"
        sub={`组织者视角 · 处理申请、查看成员并推进活动状态`}
        backTo={`/activity/${activity.id}`}
        actions={
          <>
            <Button variant="secondary" size="sm" to={`/activity/${activity.id}`}>
              查看详情
            </Button>
            {conversation && (
              <Button variant="soft" size="sm" to={`/messages/${conversation.id}`}>
                进入群聊
              </Button>
            )}
          </>
        }
      />

      <section className={styles.hero}>
        <div className={styles.heroCover}>
          <Cover activity={activity} height={94} iconSize={64} />
        </div>
        <div className={styles.heroBody}>
          <div className={cx('row', 'row--wrap', styles.heroTags)}>
            <StatusTag status={activity.status} />
            <Tag tone="pink">{CATEGORY_META[activity.category].label}</Tag>
            {activity.kind === 'individual' && <Tag tone="violet">个人活动</Tag>}
            <span className={styles.heroRole}>你是组织者</span>
          </div>
          <h2 className={styles.heroTitle}>{activity.title}</h2>
          <div className={styles.metaRow}>
            <span>
              <CalendarDays size={13} aria-hidden="true" />
              {dateTimeRange(activity.startAt, activity.endAt)}
            </span>
            <span>
              <Clock size={13} aria-hidden="true" />
              {durationLabel(durationMinutes)}
            </span>
            <span>
              <MapPin size={13} aria-hidden="true" />
              {activity.meetingPoint}
            </span>
            <span>
              <Wallet size={13} aria-hidden="true" />
              {budgetLabel(activity)} · {FEE_MODE_META[activity.feeMode].label}
            </span>
            <span>
              <Route size={13} aria-hidden="true" />
              {TRANSPORT_META[activity.transport]} · {activity.routePoints.length} 个路线节点
            </span>
          </div>

          <div className={styles.capacity}>
            <div className="progress">
              <div
                className="progress__bar"
                style={{ width: `${percent(count, activity.maxParticipants)}%` }}
              />
            </div>
            <span className={styles.capacityLabel}>
              已加入 {count}/{activity.maxParticipants} 人 · 还剩 {remaining} 个名额
            </span>
          </div>
        </div>
      </section>

      <div className={cx('stat-row', styles.stats)}>
        <div className="stat">
          <div className="stat__value">
            {count}
            <span className={styles.statSub}>/{activity.maxParticipants}</span>
          </div>
          <div className="stat__label">参与人数（含组织者）</div>
        </div>
        <div className="stat">
          <div className="stat__value">{pendingApps.length}</div>
          <div className="stat__label">待审核申请</div>
        </div>
        <div className="stat">
          <div className="stat__value">{checkedInCount}</div>
          <div className="stat__label">已签到成员</div>
        </div>
      </div>

      <div className={styles.columns}>
        <div className={styles.colMain}>
          <section className={styles.panel}>
            <div className={styles.panelHead}>
              <h2 className={styles.panelTitle}>
                <ClipboardList size={17} aria-hidden="true" />
                申请管理
              </h2>
              {pendingApps.length > 0 ? (
                <Tag tone="amber">{pendingApps.length} 条待审核</Tag>
              ) : (
                <Tag tone="green">已全部处理</Tag>
              )}
            </div>

            {!canProcessApplications && (
              <div className="notice notice--warn">
                <Info size={16} aria-hidden="true" />
                <span>
                  活动当前为「{ACTIVITY_STATUS_META[activity.status].label}」，按状态机规则不能再处理申请。
                </span>
              </div>
            )}

            {applications.length === 0 ? (
              <div className={styles.inlineEmpty}>
                <ClipboardList size={20} aria-hidden="true" />
                <div>
                  <p className={styles.inlineEmptyTitle}>还没有收到申请</p>
                  <p className={styles.inlineEmptyDesc}>
                    活动发布后，参与者提交的申请会出现在这里。可以先把活动详情分享到已有群聊，再回来审核。
                  </p>
                </div>
              </div>
            ) : (
              <>
                {pendingApps.length > 0 && (
                  <div className={styles.appGroup}>
                    <h3 className={styles.subTitle}>待审核（{pendingApps.length}）</h3>
                    <div className={styles.appList}>{pendingApps.map(renderApplication)}</div>
                  </div>
                )}
                {processedApps.length > 0 && (
                  <div className={styles.appGroup}>
                    <h3 className={styles.subTitle}>已处理（{processedApps.length}）</h3>
                    <div className={styles.appList}>{processedApps.map(renderApplication)}</div>
                  </div>
                )}
              </>
            )}
          </section>
        </div>

        <div className={styles.colSide}>
          <section className={styles.panel}>
            <div className={styles.panelHead}>
              <h2 className={styles.panelTitle}>
                <Play size={17} aria-hidden="true" />
                活动状态
              </h2>
              <StatusTag status={activity.status} />
            </div>
            <p className={styles.statusHint}>{ACTIVITY_STATUS_META[activity.status].hint}</p>

            <div className={styles.actionRow}>
              <Button
                size="sm"
                iconLeft={<Play size={14} aria-hidden="true" />}
                disabled={!startCheck.allowed}
                title={startCheck.reason ?? '开始活动'}
                onClick={handleStart}
              >
                开始活动
              </Button>
              <Button
                size="sm"
                variant="secondary"
                iconLeft={<Square size={14} aria-hidden="true" />}
                disabled={!finishCheck.allowed}
                title={finishCheck.reason ?? '结束活动'}
                onClick={handleFinish}
              >
                结束活动
              </Button>
              <Button
                size="sm"
                variant="danger-soft"
                iconLeft={<TriangleAlert size={14} aria-hidden="true" />}
                disabled={!cancelCheck.allowed}
                title={cancelCheck.reason ?? '取消活动'}
                onClick={handleCancel}
              >
                取消活动
              </Button>
            </div>

            <ul className={styles.ruleList}>
              <li>状态只能按「准备中 → 进行中 → 待评价」流转，不能跳跃。</li>
              <li>开始后成员可在「我的活动」模拟签到；组织者不代签。</li>
              <li>取消后不再接受申请；演示版不发送真实通知，只更新本地状态。</li>
            </ul>

            {activity.status === 'preparing' && earlyStart && (
              <p className={styles.ruleHint}>
                活动计划在 {dateTimeRange(activity.startAt, activity.endAt)} 开始。现在点「开始活动」会先弹出「演示模式：提前开始」确认。
              </p>
            )}
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHead}>
              <h2 className={styles.panelTitle}>
                <Users size={17} aria-hidden="true" />
                成员（{members.length}/{activity.maxParticipants}）
              </h2>
              <Tag tone="pink">组织者视角</Tag>
            </div>

            <div className={styles.memberList}>
              {members.map((member) => {
                const user = userById(member.userId);
                const attendance = ATTENDANCE_META[member.attendance];
                return (
                  <div key={member.id} className={styles.memberRow}>
                    <Avatar user={user} size="sm" />
                    <div className={styles.memberBody}>
                      <div className={styles.memberName}>
                        {user?.nickname ?? '演示用户'}
                        {member.role === 'organizer' && (
                          <Tag tone="violet" icon={<Crown size={11} aria-hidden="true" />}>
                            组织者
                          </Tag>
                        )}
                      </div>
                      <div className={styles.memberMeta}>
                        {member.role === 'organizer'
                          ? '本次活动发起人'
                          : `加入于 ${fromNowLabel(member.joinedAt, now)}`}
                      </div>
                    </div>
                    <div className={styles.memberSide}>
                      <Tag tone={attendance.tone}>{attendance.label}</Tag>
                    </div>
                  </div>
                );
              })}
            </div>

            <p className={styles.footNote}>
              签到状态来自成员自己的模拟签到。演示版不支持组织者代签，避免出现「人没到却被标记已签到」的假数据。
            </p>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHead}>
              <h2 className={styles.panelTitle}>
                <MapPin size={17} aria-hidden="true" />
                集合地点
              </h2>
              <Tag tone="slate">仅组织者可改</Tag>
            </div>

            <Field
              label="当前集合地点"
              htmlFor="manage-meeting-readonly"
              hint={
                editCheck.allowed
                  ? '准备中阶段可修改；保存后会写入群聊通知成员。'
                  : editCheck.reason
              }
            >
              <TextInput
                id="manage-meeting-readonly"
                value={activity.meetingPoint}
                readOnly
                disabled
              />
            </Field>

            {activity.notes && (
              <p className={styles.notesPreview}>注意事项：{activity.notes}</p>
            )}

            <div className={styles.actionRow}>
              <Button
                size="sm"
                variant="secondary"
                iconLeft={<Pencil size={14} aria-hidden="true" />}
                disabled={!editCheck.allowed}
                title={editCheck.reason ?? '修改集合信息'}
                onClick={openEdit}
              >
                修改集合地点 / 注意事项
              </Button>
            </div>

            <p className={styles.footNote}>
              修改后会以组织者身份向活动群聊追加一条「集合地点更新为：…」的消息，模拟通知成员；演示版不会发送真实推送。
            </p>
          </section>
        </div>
      </div>

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="修改集合信息"
        description="只允许在「准备中」修改。保存后会写入活动群聊通知成员；演示版不发送真实推送。"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditOpen(false)}>
              取消
            </Button>
            <Button onClick={submitEdit}>保存</Button>
          </>
        }
      >
        <div className={styles.editForm}>
          <Field label="集合地点" required error={editError} htmlFor="edit-meeting">
            <TextInput
              id="edit-meeting"
              value={editMeeting}
              onChange={(event) => {
                setEditMeeting(event.target.value);
                if (editError) setEditError(undefined);
              }}
              placeholder="例如：东湖绿道湖光序曲驿站门口"
              maxLength={60}
              invalid={Boolean(editError)}
            />
          </Field>
          <Field
            label="注意事项"
            hint="选填，会同步到活动详情的注意事项。"
            htmlFor="edit-notes"
          >
            <TextArea
              id="edit-notes"
              value={editNotes}
              onChange={(event) => setEditNotes(event.target.value)}
              placeholder="例如：地铁 8 号线 A 口出，穿舒适的鞋。"
              maxLength={200}
            />
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={dialog?.kind === 'start-early'}
        title="演示模式：提前开始"
        description={`活动计划在 ${dateTimeRange(activity.startAt, activity.endAt)} 开始，现在还没到开始时间。为方便演示状态流转，可以提前开始；真实产品里应等到活动开始时间。`}
        confirmText="提前开始"
        cancelText="再等等"
        onConfirm={runStart}
        onClose={() => setDialog(null)}
      />

      <ConfirmDialog
        open={dialog?.kind === 'finish'}
        title="结束这个活动？"
        description="结束后活动进入「待评价」，成员可以提交评价。演示版不会发送真实通知，只更新本地状态。"
        confirmText="结束活动"
        cancelText="继续进行"
        onConfirm={runFinish}
        onClose={() => setDialog(null)}
      />

      <ConfirmDialog
        open={dialog?.kind === 'cancel'}
        title="取消这个活动？"
        description="取消后活动变为「已取消」，不再接受申请，已加入的成员会在「我的活动」看到取消状态。真实产品会通知成员，但演示版不会发送真实推送，只更新本地状态。"
        confirmText="确认取消"
        cancelText="保留活动"
        danger
        onConfirm={runCancel}
        onClose={() => setDialog(null)}
      />

      <ConfirmDialog
        open={dialog?.kind === 'update-info'}
        title="确认修改集合信息？"
        description={
          dialog?.kind === 'update-info'
            ? `新集合地点为「${editMeeting.trim()}」。保存后会写入活动群聊通知成员（演示版不发送真实推送）。`
            : null
        }
        confirmText="确认修改"
        cancelText="再改改"
        onConfirm={runUpdateInfo}
        onClose={closeUpdateConfirm}
      />

      <ConfirmDialog
        open={dialog?.kind === 'reject'}
        title="拒绝这条申请？"
        description={
          dialog?.kind === 'reject'
            ? `确认拒绝「${dialog.name}」的申请？拒绝后该用户会看到「已拒绝」，重新申请需要再次提交。`
            : null
        }
        confirmText="拒绝申请"
        cancelText="先不拒绝"
        danger
        onConfirm={handleRejectConfirm}
        onClose={() => setDialog(null)}
      />
    </div>
  );
}

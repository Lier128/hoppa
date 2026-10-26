import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { canLeaveActivity, isFull, memberCount, remainingSeats } from '@/domain/rules';
import type { ReportReason, ReportStatus } from '@/types';
import {
  ACTIVITY_STATUS_META,
  CATEGORY_META,
  FEE_MODE_META,
  REPORT_REASON_META,
  REPORT_REASONS,
} from '@/types';
import { budgetLabel, copyText, cx } from '@/lib/format';
import { dateTimeRange, fromNowLabel } from '@/lib/date';
import { useApp } from '@/store/AppStore';
import {
  Avatar,
  Button,
  CategoryIcon,
  CategoryTag,
  ConfirmDialog,
  EmptyState,
  Field,
  Modal,
  PageHead,
  StatusTag,
  Tag,
  TextArea,
  useToast,
} from '@/components/ui';
import {
  CalendarDays,
  CircleCheck,
  Clock,
  Copy,
  Flag,
  Info,
  LogOut,
  MapPin,
  Phone,
  Search,
  ShieldAlert,
  ShieldCheck,
  UserRound,
  Users,
} from '@/components/ui/icons';
import styles from './SafetyCenter.module.css';

/** 演示版举报状态文案（ReportStatus 在 types 里只有枚举，没有中文元数据） */
const REPORT_STATUS_META: Record<ReportStatus, { label: string; tone: 'green' | 'amber' | 'slate' }> = {
  recorded: { label: '已记录', tone: 'green' },
  reviewing: { label: '复核中', tone: 'amber' },
  closed: { label: '已关闭', tone: 'slate' },
};

/** 6 条线下安全建议，逐条写清具体做法，不承诺"全程监管 / 绝对安全" */
const SAFETY_TIPS = [
  {
    title: '告知亲友',
    text: '出发前把活动时间、集合地点、组织者昵称发给你信任的一位亲友，并约好报平安的时间。',
  },
  {
    title: '结伴往返',
    text: '尽量和成员一起往返，避免深夜独自前往或离开陌生地点；打车时可把车牌号发给亲友。',
  },
  {
    title: '不单独离队',
    text: '中途需要离开时先在群聊里说明去向，不要不打招呼就单独行动或临时改去别的地点。',
  },
  {
    title: '保管财物',
    text: '人流密集处把包放在身前，不携带大量现金，也不要把贵重物品交给刚认识的成员保管。',
  },
  {
    title: '遇事先联系组织者',
    text: '遇到骚扰、纠纷或身体不适，第一时间告诉组织者，并保留聊天记录、截图等凭证。',
  },
  {
    title: '紧急情况直接拨打 110 / 120',
    text: '真实紧急情况请直接拨打 110（报警）或 120（急救），不要等待平台处理；本演示不会替你拨号。',
  },
];

type ReportTarget = 'activity' | 'user';

export default function SafetyCenterPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { state, now, currentUser, userById, activityById, leaveActivity, saveReport, track } = useApp();
  const toast = useToast();
  const activity = activityById(id);

  const [reportOpen, setReportOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState<ReportTarget>('activity');
  const [reportReason, setReportReason] = useState<ReportReason | ''>('');
  const [reportDetail, setReportDetail] = useState('');
  const [reasonError, setReasonError] = useState('');
  const [lastReportId, setLastReportId] = useState('');
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpDone, setHelpDone] = useState(false);
  const [copying, setCopying] = useState(false);

  // 页面进入埋点（StrictMode 双挂载去重；切换演示身份算一次新的浏览）
  const trackedKey = useRef('');
  useEffect(() => {
    if (!activity) return;
    const key = `${currentUser.id}:${activity.id}`;
    if (trackedKey.current === key) return;
    trackedKey.current = key;
    track('safety_center_open', { activity_id: activity.id });
  }, [activity, currentUser.id, track]);

  if (!activity) {
    return (
      <div className="page">
        <EmptyState
          icon={<Search size={22} />}
          title="找不到这个活动"
          description={`链接里的活动 ID「${id}」没有对应的演示数据，无法打开安全中心。`}
          action={<Button to="/">返回首页</Button>}
        />
      </div>
    );
  }

  const organizer = userById(activity.organizerId);
  const organizerName = organizer?.nickname ?? '演示用户';
  const count = memberCount(state, activity.id);
  const full = isFull(state, activity);
  const remaining = remainingSeats(state, activity);
  const leaveCheck = canLeaveActivity(state, activity, currentUser.id);
  const myReports = state.reports
    .filter(
      (report) =>
        report.reporterId === currentUser.id &&
        ((report.targetType === 'activity' && report.targetId === activity.id) ||
          (report.targetType === 'user' && report.targetId === activity.organizerId)),
    )
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  const buildShareText = () =>
    [
      `【HOPPA 活动】${activity.title}`,
      `时间：${dateTimeRange(activity.startAt, activity.endAt)}`,
      `集合：${activity.meetingPoint}`,
      `组织者：${organizerName}`,
      `人数：${count}/${activity.maxParticipants} 人`,
      `费用：${budgetLabel(activity)}（${FEE_MODE_META[activity.feeMode].label}：${FEE_MODE_META[activity.feeMode].hint}）`,
      `活动状态：${ACTIVITY_STATUS_META[activity.status].label}`,
      '以上信息来自 HOPPA 作品集演示环境，不是真实活动，请勿据此安排真实行程。',
    ].join('\n');

  const handleCopy = async () => {
    setCopying(true);
    const ok = await copyText(buildShareText());
    setCopying(false);
    if (ok) toast.success('活动信息已复制，可以粘贴给亲友');
    else toast.error('复制失败，请手动选择页面文字复制');
  };

  const openReport = () => {
    setReportTarget('activity');
    setReportReason('');
    setReportDetail('');
    setReasonError('');
    setReportOpen(true);
  };

  const submitReport = () => {
    if (!reportReason) {
      setReasonError('请选择举报原因');
      return;
    }
    const result = saveReport({
      targetType: reportTarget,
      targetId: reportTarget === 'activity' ? activity.id : activity.organizerId,
      reason: reportReason,
      detail: reportDetail,
    });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setLastReportId(result.value);
    setReportOpen(false);
    toast.success('举报已记录（演示）');
  };

  const doLeave = () => {
    const result = leaveActivity(activity.id);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success('已退出活动');
    navigate(`/activity/${activity.id}`);
  };

  return (
    <div className={cx('page', styles.pageRoot)}>
      <PageHead
        title="安全中心"
        sub={`${activity.title} · ${activity.city}`}
        backTo={`/activity/${activity.id}`}
        actions={
          <Tag tone="pink" outline>
            演示功能
          </Tag>
        }
      />

      <div className={cx('notice', 'notice--warn', styles.topNotice)}>
        <ShieldAlert size={16} aria-hidden="true" />
        <span>
          <strong>本页为演示功能，不构成真实安全保障。</strong>
          举报、退出活动、紧急求助都是本地模拟；不会拨打电话、不获取定位、不向任何第三方发送数据，
          也不承诺「全程监管」或「实时保护」。
        </span>
      </div>

      {/* ---------------------------------------------------- 活动摘要 */}
      <section className={cx('card', 'card--pad', styles.section)} aria-labelledby="safety-summary">
        <h2 className={styles.sectionTitle} id="safety-summary">
          <Info size={17} aria-hidden="true" />
          活动摘要
        </h2>
        <div className={styles.summaryHead}>
          <span
            className={styles.catChip}
            style={{ background: CATEGORY_META[activity.category].gradient }}
            aria-hidden="true"
          >
            <CategoryIcon category={activity.category} size={22} />
          </span>
          <div style={{ minWidth: 0 }}>
            <div className={cx('row', 'row--wrap', styles.summaryTags)}>
              <StatusTag status={activity.status} />
              <CategoryTag category={activity.category} />
            </div>
            <p className={styles.summaryTitle}>{activity.title}</p>
          </div>
        </div>

        <div className="meta-list">
          <div className="meta-item">
            <Clock size={16} className="meta-item__icon" aria-hidden="true" />
            <span className="meta-item__label">时间</span>
            <span className="meta-item__value">
              {dateTimeRange(activity.startAt, activity.endAt)}
              <span className={styles.valueHint}>{ACTIVITY_STATUS_META[activity.status].hint}</span>
            </span>
          </div>
          <div className="meta-item">
            <MapPin size={16} className="meta-item__icon" aria-hidden="true" />
            <span className="meta-item__label">集合地点</span>
            <span className="meta-item__value">{activity.meetingPoint}</span>
          </div>
          <div className="meta-item">
            <UserRound size={16} className="meta-item__icon" aria-hidden="true" />
            <span className="meta-item__label">组织者</span>
            <span className="meta-item__value">
              <span className="row" style={{ gap: 6 }}>
                <Avatar user={organizer} size="xs" />
                {organizerName}
              </span>
            </span>
          </div>
          <div className="meta-item">
            <Users size={16} className="meta-item__icon" aria-hidden="true" />
            <span className="meta-item__label">人数</span>
            <span className="meta-item__value">
              {count}/{activity.maxParticipants} 人
              <span className={styles.valueHint}>
                {full ? '名额已满' : `还剩 ${remaining} 个名额`} · 组织者计入人数上限
              </span>
            </span>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------- 参与规则 */}
      <section className={cx('card', 'card--pad', styles.section)} aria-labelledby="safety-rules">
        <h2 className={styles.sectionTitle} id="safety-rules">
          <ShieldCheck size={17} aria-hidden="true" />
          参与规则
        </h2>
        <ul className={styles.ruleList}>
          <li>
            活动人数上限 {activity.maxParticipants} 人（含组织者），目前已加入 {count} 人
            {full ? '，名额已满。' : `，还剩 ${remaining} 个名额。`}
          </li>
          <li>参加需要在活动详情提交申请，由组织者审核；审核通过后才会进入活动群聊。</li>
          <li>
            费用规则：{budgetLabel(activity)}（{FEE_MODE_META[activity.feeMode].label}：
            {FEE_MODE_META[activity.feeMode].hint}）。预算为人均预估，不构成支付承诺，本演示不涉及支付与资金托管。
          </li>
          <li>活动时间与集合地点以活动详情为准；如需变更，由组织者在群聊里通知，请留意消息。</li>
          <li>
            当前状态：{ACTIVITY_STATUS_META[activity.status].label}。
            {activity.status === 'cancelled'
              ? '活动已取消，不再接受新的申请。'
              : activity.status === 'preparing'
                ? '仍在招募中，可以正常提交申请。'
                : ACTIVITY_STATUS_META[activity.status].hint}
          </li>
          <li>本演示不采集手机号、身份证或精确位置，也不会向任何人暴露你的实时位置。</li>
        </ul>
      </section>

      {/* ---------------------------------------------------- 线下安全建议 */}
      <section className={cx('card', 'card--pad', styles.section)} aria-labelledby="safety-tips">
        <h2 className={styles.sectionTitle} id="safety-tips">
          <ShieldAlert size={17} aria-hidden="true" />
          线下安全建议
        </h2>
        <p className={styles.sectionLead}>
          以下建议适用于任何一次线下见面。它们是通用做法，不是对本次活动的安全承诺。
        </p>
        <ol className={styles.tipList}>
          {SAFETY_TIPS.map((tip, index) => (
            <li key={tip.title} className={styles.tipItem}>
              <span className={styles.tipIndex} aria-hidden="true">
                {index + 1}
              </span>
              <span className={styles.tipBody}>
                <span className={styles.tipTitle}>{tip.title}</span>
                <span className={styles.tipText}>{tip.text}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      {/* ---------------------------------------------------- 操作 */}
      <section className={cx('card', 'card--pad', styles.section)} aria-labelledby="safety-actions">
        <h2 className={styles.sectionTitle} id="safety-actions">
          <Flag size={17} aria-hidden="true" />
          安全操作
        </h2>

        <div className={styles.actions}>
          {/* 复制活动信息 */}
          <div className={styles.actionRow}>
            <span className={cx(styles.actionIcon, styles.actionIconInfo)} aria-hidden="true">
              <Copy size={17} />
            </span>
            <span className={styles.actionText}>
              <span className={styles.actionTitle}>复制活动信息</span>
              <span className={styles.actionDesc}>
                把时间、集合地点、组织者和费用复制到剪贴板，方便发给亲友报备行程。
              </span>
            </span>
            <Button size="sm" variant="secondary" onClick={handleCopy} disabled={copying}>
              {copying ? '复制中…' : '复制'}
            </Button>
          </div>

          {/* 举报问题 */}
          <div className={styles.actionRow}>
            <span className={cx(styles.actionIcon, styles.actionIconWarn)} aria-hidden="true">
              <Flag size={17} />
            </span>
            <span className={styles.actionText}>
              <span className={styles.actionTitle}>举报问题</span>
              <span className={styles.actionDesc}>
                对活动信息、费用或组织者行为有疑问时可以举报；记录只保存在本浏览器。
              </span>
            </span>
            <Button size="sm" variant="secondary" onClick={openReport}>
              举报
            </Button>
          </div>

          {/* 退出活动 */}
          <div className={styles.actionRow}>
            <span className={cx(styles.actionIcon, styles.actionIconDanger)} aria-hidden="true">
              <LogOut size={17} />
            </span>
            <span className={styles.actionText}>
              <span className={styles.actionTitle}>退出活动</span>
              <span className={styles.actionDesc}>
                {leaveCheck.allowed
                  ? '退出后会从成员列表和群聊中移除；如果活动仍可申请，可以重新提交。'
                  : (leaveCheck.reason ?? '当前无法退出该活动。')}
              </span>
            </span>
            {leaveCheck.allowed ? (
              <Button size="sm" variant="danger-soft" onClick={() => setLeaveOpen(true)}>
                退出活动
              </Button>
            ) : (
              <Button size="sm" variant="secondary" disabled aria-disabled="true">
                不可退出
              </Button>
            )}
          </div>

          {/* 演示紧急求助 */}
          <div className={cx(styles.actionRow, styles.actionRowDanger)}>
            <span className={cx(styles.actionIcon, styles.actionIconDanger)} aria-hidden="true">
              <Phone size={17} />
            </span>
            <span className={styles.actionText}>
              <span className={styles.actionTitle}>
                演示紧急求助
                <span className="demo-badge">演示</span>
              </span>
              <span className={styles.actionDesc}>
                仅演示确认流程：不会拨打电话、不获取定位、不向任何第三方发送数据。
                {helpDone && ' 你已确认过演示说明。'}
              </span>
            </span>
            <Button
              size="sm"
              variant="danger"
              onClick={() => setHelpOpen(true)}
              iconLeft={<Phone size={14} aria-hidden="true" />}
            >
              演示求助
            </Button>
          </div>
        </div>

        {helpDone && (
          <div className={cx('notice', 'notice--success', styles.inlineNotice)}>
            <CircleCheck size={15} aria-hidden="true" />
            <span>已完成演示确认：未拨打 110 / 120，未获取定位，未发送任何数据。</span>
          </div>
        )}

        <p className={styles.actionFoot}>
          真实紧急情况请直接拨打 110（报警）或 120（急救）。本页所有操作都不会联网。
        </p>
      </section>

      {/* ---------------------------------------------------- 举报记录 */}
      {(myReports.length > 0 || lastReportId) && (
        <section className={cx('card', 'card--pad', styles.section)} aria-labelledby="safety-reports">
          <h2 className={styles.sectionTitle} id="safety-reports">
            <Flag size={17} aria-hidden="true" />
            我的举报记录
          </h2>

          {lastReportId && (
            <div className={cx('notice', 'notice--success', styles.inlineNotice)}>
              <CircleCheck size={15} aria-hidden="true" />
              <span>
                <strong>已记录（演示）。</strong>这条举报已保存在本地 localStorage，不会发送给真实客服，
                也不会通知被举报人。
              </span>
            </div>
          )}

          <ul className={styles.reportList}>
            {myReports.map((report) => {
              const statusMeta = REPORT_STATUS_META[report.status];
              return (
                <li key={report.id} className={styles.reportItem}>
                  <div className={cx('row', 'row--between', styles.reportHead)}>
                    <span className={styles.reportReason}>
                      {REPORT_REASON_META[report.reason]}
                      <span className={styles.reportTarget}>
                        · 举报对象：
                        {report.targetType === 'activity' ? '活动' : `组织者 ${organizerName}`}
                      </span>
                    </span>
                    <Tag tone={statusMeta.tone}>{statusMeta.label}</Tag>
                  </div>
                  {report.detail && <p className={styles.reportDetail}>{report.detail}</p>}
                  <p className={styles.reportMeta}>
                    记录编号 {report.id} · {fromNowLabel(report.createdAt, now)} · 演示数据，可被「重置演示数据」清空
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* ---------------------------------------------------- 返回入口 */}
      <div className={styles.footLinks}>
        <Button to={`/activity/${activity.id}`} variant="secondary" iconLeft={<CalendarDays size={15} aria-hidden="true" />}>
          返回活动详情
        </Button>
        {activity.routePoints.length > 0 && (
          <Button to={`/route/${activity.id}`} variant="secondary">
            查看路线
          </Button>
        )}
      </div>

      {/* ---------------------------------------------------- 举报弹窗 */}
      <Modal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        title="举报问题"
        description="举报为本地模拟记录：不会发送给真实客服，也不会通知被举报人。请如实填写，便于复盘演示。"
        footer={
          <>
            <Button variant="secondary" onClick={() => setReportOpen(false)}>
              取消
            </Button>
            <Button variant="danger" onClick={submitReport}>
              提交举报
            </Button>
          </>
        }
      >
        <div className="stack">
          <Field label="举报对象">
            <div className={styles.chipRow}>
              <button
                type="button"
                className={cx('chip', reportTarget === 'activity' && 'is-active')}
                aria-pressed={reportTarget === 'activity'}
                onClick={() => setReportTarget('activity')}
              >
                活动：{activity.title}
              </button>
              <button
                type="button"
                className={cx('chip', reportTarget === 'user' && 'is-active')}
                aria-pressed={reportTarget === 'user'}
                onClick={() => setReportTarget('user')}
              >
                组织者：{organizerName}
              </button>
            </div>
          </Field>

          <Field
            label="举报原因"
            required
            error={reasonError}
            hint={reasonError ? undefined : '从以下原因中选择一项'}
          >
            <div className={styles.chipRow} role="group" aria-label="举报原因">
              {REPORT_REASONS.map((reason) => (
                <button
                  key={reason}
                  type="button"
                  className={cx('chip', reportReason === reason && 'is-active')}
                  aria-pressed={reportReason === reason}
                  onClick={() => {
                    setReportReason(reason);
                    setReasonError('');
                  }}
                >
                  {REPORT_REASON_META[reason]}
                </button>
              ))}
            </div>
          </Field>

          <Field
            label="补充说明（选填）"
            hint={
              <span className={styles.counterRow}>
                <span>最多 200 字，请描述发生了什么、什么时候发生</span>
                <span className="mono">{reportDetail.length}/200</span>
              </span>
            }
          >
            <TextArea
              value={reportDetail}
              maxLength={200}
              onChange={(event) => setReportDetail(event.target.value)}
              placeholder="例如：组织者临时加收了未说明的费用……"
            />
          </Field>

          <p className="tiny faint">提交后会立即出现在本页「我的举报记录」中，状态为「已记录」。</p>
        </div>
      </Modal>

      {/* ---------------------------------------------------- 退出确认 */}
      <ConfirmDialog
        open={leaveOpen}
        title="确认退出活动？"
        description="退出后会从成员列表和活动群聊中移除，组织者会看到你的申请状态变为「已退出」。如果活动仍可申请，你可以重新提交。"
        confirmText="退出活动"
        danger
        onClose={() => setLeaveOpen(false)}
        onConfirm={doLeave}
      />

      {/* ---------------------------------------------------- 演示紧急求助 */}
      <ConfirmDialog
        open={helpOpen}
        title="演示紧急求助"
        description="这是一个演示按钮：不会拨打电话，不会获取你的定位，也不会向任何第三方发送数据。真实紧急情况请直接拨打 110（报警）或 120（急救）。"
        confirmText="我了解，仅演示"
        onClose={() => setHelpOpen(false)}
        onConfirm={() => {
          setHelpDone(true);
          toast.info('演示：未拨打电话、未获取定位、未发送任何数据');
        }}
      >
        <ul className={styles.helpList}>
          <li>不会调用拨号盘，不会拨打 110 / 120。</li>
          <li>不会申请或读取定位权限。</li>
          <li>不会把活动信息、你的身份或位置发送给任何人。</li>
        </ul>
      </ConfirmDialog>
    </div>
  );
}

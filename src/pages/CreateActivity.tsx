import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ActivityDraft, ActivityKind, Category, FeeMode } from '@/types';
import {
  CATEGORIES,
  CATEGORY_META,
  EMPTY_ACTIVITY_DRAFT,
  FEE_MODE_META,
  TRANSPORT_META,
  TRANSPORTS,
} from '@/types';
import { hasErrors, validateActivityDraft, type DraftErrors } from '@/domain/rules';
import { useApp } from '@/store/AppStore';
import {
  Avatar,
  Button,
  CategoryIcon,
  ConfirmDialog,
  Cover,
  Field,
  InputField,
  PageHead,
  TextArea,
  TextInput,
  useToast,
} from '@/components/ui';
import {
  ArrowLeft,
  CalendarDays,
  Clock,
  Coins,
  Info,
  MapPin,
  Minus,
  Pencil,
  Plus,
  Rocket,
  Route,
  Tag,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from '@/components/ui/icons';
import { budgetLabel, cx } from '@/lib/format';
import {
  addDays,
  addMinutes,
  combineDateTime,
  dateTimeRange,
  durationLabel,
  inputDate,
  localISO,
} from '@/lib/date';
import styles from './CreateActivity.module.css';

interface RouteDraft {
  name: string;
  note: string;
  stayMinutes: number;
}

const KIND_OPTIONS: Array<{ value: ActivityKind; label: string; hint: string }> = [
  { value: 'group', label: '社群活动', hint: '有固定组织者，公开招募' },
  { value: 'individual', label: '个人活动', hint: '轻量的一对一邀约' },
];

const DURATION_PRESETS = [60, 90, 120, 180, 240, 360];

const COMMON_TAGS = ['新手友好', '出片', '慢节奏', '会带路', '安静', '社牛', '周末', '轻量', '咖啡', 'AA'];

function hoursLabel(minutes: number): string {
  return `${minutes / 60} 小时`;
}

function SectionHead({
  icon: Icon,
  title,
  desc,
}: {
  icon: LucideIcon;
  title: string;
  desc?: string;
}) {
  return (
    <div className={styles.sectionHead}>
      <span className={styles.sectionIcon} aria-hidden="true">
        <Icon size={16} />
      </span>
      <div>
        <h2 className={styles.sectionTitle}>{title}</h2>
        {desc && <p className={styles.sectionDesc}>{desc}</p>}
      </div>
    </div>
  );
}

/** 发布前的实时预览卡片：与列表卡同一套视觉语言，但使用草稿数据（还没有 activity id） */
function ActivityPreview({ draft, routeCount }: { draft: ActivityDraft; routeCount: number }) {
  const { currentUser } = useApp();
  const category: Category = draft.category || 'citywalk';
  const start = combineDateTime(draft.date, draft.startTime);
  const timeLabel = start
    ? dateTimeRange(
        localISO(start),
        localISO(addMinutes(start, Math.max(30, draft.durationMinutes || 0))),
      )
    : '时间待定';
  const feeText = budgetLabel({
    feeMode: (draft.feeMode || 'free') as FeeMode,
    budgetMin: draft.budgetMin,
    budgetMax: draft.budgetMax,
  });

  return (
    <aside className={styles.previewCol} aria-label="发布前活动卡预览">
      <div className={styles.previewHead}>
        <h2 className={styles.previewHeadTitle}>发布前预览</h2>
        <span className="tag tag--pink">实时</span>
      </div>

      <article className={styles.previewCard}>
        <Cover
          activity={{ category, coverTone: 9, title: draft.title.trim() || '你的活动标题' }}
          height={142}
          iconSize={94}
        />
        <div className={styles.previewBody}>
          <div className={cx('row', 'row--wrap', styles.previewTags)}>
            <span className="tag tag--pink">准备中</span>
            <span className="tag tag--outline">{CATEGORY_META[category].label}</span>
            {draft.kind === 'individual' && <span className="tag tag--violet">个人活动</span>}
          </div>

          <h3 className={styles.previewName}>{draft.title.trim() || '你的活动标题'}</h3>

          <div className={styles.previewMeta}>
            <span>
              <CalendarDays size={13} aria-hidden="true" />
              {timeLabel}
            </span>
            <span>
              <Clock size={13} aria-hidden="true" />
              {durationLabel(draft.durationMinutes)}
            </span>
            <span>
              <MapPin size={13} aria-hidden="true" />
              {draft.meetingPoint.trim() || '集合地点待填写'}
            </span>
            <span>
              <Users size={13} aria-hidden="true" />
              人数上限 {draft.maxParticipants} 人
            </span>
            <span>
              <Wallet size={13} aria-hidden="true" />
              {feeText} · {TRANSPORT_META[draft.transport]}
            </span>
            {routeCount > 0 && (
              <span>
                <Route size={13} aria-hidden="true" />
                {routeCount} 个路线节点
              </span>
            )}
          </div>

          {draft.description.trim() ? (
            <p className={styles.previewDesc}>{draft.description.trim()}</p>
          ) : (
            <p className={styles.previewEmpty}>活动介绍会显示在这里，建议写清楚流程与适合谁参加。</p>
          )}

          {draft.tags.length > 0 ? (
            <div className={styles.previewTags}>
              {draft.tags.map((tag) => (
                <span key={tag} className="tag tag--outline">
                  {tag}
                </span>
              ))}
            </div>
          ) : (
            <p className={styles.previewEmpty}>兴趣标签会显示在这里。</p>
          )}

          <div className={styles.previewFoot}>
            <span className={cx('row', styles.previewOrganizerRow)}>
              <Avatar user={currentUser} size="xs" />
              <span className={styles.previewOrganizer}>{currentUser.nickname} · 发起人</span>
            </span>
            <span className={styles.previewFee}>{feeText}</span>
          </div>
        </div>
      </article>

      <p className={styles.previewNote}>
        这是其他用户在列表里看到的卡片示意；发布后还可以在活动详情里继续补充信息。
      </p>
    </aside>
  );
}

export default function CreateActivityPage() {
  const navigate = useNavigate();
  const { currentUser, createActivity, now } = useApp();
  const { success, error: toastError, info } = useToast();

  const initialDraftRef = useRef<ActivityDraft>({
    ...EMPTY_ACTIVITY_DRAFT,
    date: inputDate(addDays(new Date(), 1)),
    startTime: '19:00',
  });
  const [draft, setDraft] = useState<ActivityDraft>(initialDraftRef.current);
  const [routes, setRoutes] = useState<RouteDraft[]>([]);
  const [errors, setErrors] = useState<DraftErrors>({});
  const [tagInput, setTagInput] = useState('');
  const [backOpen, setBackOpen] = useState(false);

  const dirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(initialDraftRef.current) || routes.length > 0,
    [draft, routes],
  );

  // 有未保存内容时，刷新 / 关闭页面先让浏览器拦一下
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  const patch = (next: Partial<ActivityDraft>) => {
    setDraft((prev) => ({ ...prev, ...next }));
    setErrors((prev) => {
      const keys = Object.keys(next) as Array<keyof DraftErrors>;
      if (!keys.some((key) => key in prev)) return prev;
      const copy = { ...prev };
      for (const key of keys) delete copy[key];
      if ('date' in next || 'startTime' in next) delete copy.startAt;
      return copy;
    });
  };

  // 即时提示：选了过去的日期 / 时间，不用等提交就能看到
  const startAtError = useMemo(() => {
    if (!draft.date || !draft.startTime) return undefined;
    const start = combineDateTime(draft.date, draft.startTime);
    if (!start) return '日期或时间格式不正确';
    return start.getTime() <= now.getTime() ? '所选时间已过去，请换一个未来的日期或时间' : undefined;
  }, [draft.date, draft.startTime, now]);

  const durationIsPreset = DURATION_PRESETS.includes(draft.durationMinutes);

  const addTag = (raw: string) => {
    const tag = raw.trim();
    if (!tag) return;
    if (draft.tags.includes(tag)) {
      info('这个标签已经加过了');
      return;
    }
    if (draft.tags.length >= 5) {
      toastError('兴趣标签最多 5 个');
      return;
    }
    patch({ tags: [...draft.tags, tag] });
    setTagInput('');
  };

  const removeTag = (tag: string) => patch({ tags: draft.tags.filter((item) => item !== tag) });

  const addRoute = () => {
    setRoutes((prev) => [...prev, { name: '', note: '', stayMinutes: 20 }]);
  };

  const updateRoute = (index: number, next: Partial<RouteDraft>) => {
    setRoutes((prev) => prev.map((item, i) => (i === index ? { ...item, ...next } : item)));
  };

  const removeRoute = (index: number) => {
    setRoutes((prev) => prev.filter((_, i) => i !== index));
  };

  const filledRoutePoints = routes.filter((item) => item.name.trim().length > 0);

  const handleBack = () => {
    if (dirty) setBackOpen(true);
    else navigate('/my');
  };

  const handleSubmit = () => {
    const nextErrors = validateActivityDraft(draft, new Date());
    setErrors(nextErrors);
    if (hasErrors(nextErrors)) {
      const count = Object.keys(nextErrors).length;
      toastError(`还有 ${count} 项需要完善，请检查标红的字段`);
      window.setTimeout(() => {
        const first = document.querySelector<HTMLElement>('[aria-invalid="true"]');
        first?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        first?.focus?.();
      }, 60);
      return;
    }

    const routePoints = filledRoutePoints.map((item) => ({
      name: item.name.trim(),
      note: item.note.trim(),
      stayMinutes: Math.max(5, Math.min(240, Math.round(Number(item.stayMinutes) || 20))),
    }));

    const result = createActivity(draft, routePoints);
    if (!result.ok) {
      if (result.field) {
        setErrors((prev) => ({ ...prev, [result.field as keyof DraftErrors]: result.error }));
      }
      toastError(result.error);
      return;
    }

    success('活动已发布，你是本活动组织者');
    navigate(`/activity/${result.value}`);
  };

  return (
    <div className="page">
      <PageHead
        title="创建活动"
        sub="把时间、地点和费用规则说清楚，更容易约到同频的人。"
        actions={
          <Button variant="ghost" iconLeft={<ArrowLeft size={15} />} onClick={handleBack}>
            返回
          </Button>
        }
      />

      <div className="notice notice--info">
        <Info size={16} aria-hidden="true" />
        <span>
          发布后会直接进入「准备中」，你自动成为组织者，无需申请。活动开始后修改集合地点需要通知成员，因此本页只在发布前设置一次。
        </span>
      </div>

      <div className={styles.layout}>
        <div className={styles.formCol}>
          <section className={styles.panel}>
            <SectionHead
              icon={Pencil}
              title="基础信息"
              desc="标题与类型会出现在活动卡最显眼的位置。"
            />

            <div className={styles.fieldGrid}>
              <div className={styles.span2}>
                <InputField
                  label="活动标题"
                  required
                  value={draft.title}
                  onChange={(value) => patch({ title: value })}
                  placeholder="例如：东湖绿道 · 落日夜走"
                  maxLength={40}
                  error={errors.title}
                  hint={`${draft.title.length}/40 字`}
                />
              </div>

              <div className={styles.span2}>
                <Field
                  label="活动形式"
                  required
                  hint={KIND_OPTIONS.find((option) => option.value === draft.kind)?.hint}
                >
                  <div className={styles.chipRow} role="group" aria-label="活动形式">
                    {KIND_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className={cx('chip', draft.kind === option.value && 'is-active')}
                        aria-pressed={draft.kind === option.value}
                        onClick={() => patch({ kind: option.value })}
                        title={option.hint}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </Field>
              </div>

              <div className={styles.span2}>
                <Field label="活动类型" required error={errors.category}>
                  <div className={styles.chipRow} role="group" aria-label="活动类型">
                    {CATEGORIES.map((category) => (
                      <button
                        key={category}
                        type="button"
                        className={cx(
                          'chip',
                          styles.categoryChip,
                          draft.category === category && 'is-active',
                        )}
                        aria-pressed={draft.category === category}
                        onClick={() => patch({ category })}
                      >
                        <CategoryIcon category={category} size={14} />
                        {CATEGORY_META[category].label}
                      </button>
                    ))}
                  </div>
                </Field>
              </div>

              <Field label="活动日期" required error={errors.date} htmlFor="activity-date">
                <TextInput
                  id="activity-date"
                  type="date"
                  min={inputDate(now)}
                  value={draft.date}
                  onChange={(event) => patch({ date: event.target.value })}
                  invalid={Boolean(errors.date)}
                />
              </Field>

              <Field
                label="开始时间"
                required
                error={errors.startTime || errors.startAt || startAtError}
                hint="需晚于当前时间"
                htmlFor="activity-time"
              >
                <TextInput
                  id="activity-time"
                  type="time"
                  value={draft.startTime}
                  onChange={(event) => patch({ startTime: event.target.value })}
                  invalid={Boolean(errors.startTime || errors.startAt || startAtError)}
                />
              </Field>

              <div className={styles.span2}>
                <Field
                  label="预计时长"
                  required
                  error={errors.durationMinutes}
                  hint="30 分钟 – 12 小时，也可以直接点常用时长"
                >
                  <div className={styles.durationWrap}>
                    <div className={styles.durationRow}>
                      <TextInput
                        type="number"
                        inputMode="numeric"
                        min={30}
                        max={720}
                        step={15}
                        value={draft.durationMinutes || ''}
                        onChange={(event) =>
                          patch({
                            durationMinutes:
                              event.target.value === '' ? 0 : Number(event.target.value),
                          })
                        }
                        aria-label="预计时长（分钟）"
                        invalid={Boolean(errors.durationMinutes)}
                        className={styles.durationInput}
                      />
                      <span className={styles.unit}>分钟</span>
                      <span className={styles.durationPreview}>
                        {durationLabel(draft.durationMinutes)}
                      </span>
                    </div>
                    <div className={styles.presetRow}>
                      {DURATION_PRESETS.map((minutes) => (
                        <button
                          key={minutes}
                          type="button"
                          className={cx(
                            'chip',
                            styles.presetChip,
                            draft.durationMinutes === minutes && 'is-active',
                          )}
                          aria-pressed={draft.durationMinutes === minutes}
                          onClick={() => patch({ durationMinutes: minutes })}
                        >
                          {hoursLabel(minutes)}
                        </button>
                      ))}
                      {!durationIsPreset && draft.durationMinutes > 0 && (
                        <span className={styles.customDuration}>
                          自定义 {draft.durationMinutes} 分钟
                        </span>
                      )}
                    </div>
                  </div>
                </Field>
              </div>
            </div>
          </section>

          <section className={styles.panel}>
            <SectionHead
              icon={MapPin}
              title="地点与人数"
              desc="第一次见面，集合点要具体到能一眼找到。"
            />

            <div className={styles.fieldGrid}>
              <div className={styles.span2}>
                <InputField
                  label="集合地点"
                  required
                  value={draft.meetingPoint}
                  onChange={(value) => patch({ meetingPoint: value })}
                  placeholder="例如：东湖绿道湖光序曲驿站门口"
                  maxLength={60}
                  error={errors.meetingPoint}
                  hint="写到可被直接找到的位置，避免只写「东湖」这类大范围地名。"
                />
              </div>

              <Field
                label="人数上限"
                required
                error={errors.maxParticipants}
                hint="含组织者在内，演示版上限 30 人"
              >
                <div className={styles.stepper}>
                  <button
                    type="button"
                    className={styles.stepBtn}
                    aria-label="减少人数"
                    disabled={draft.maxParticipants <= 2}
                    onClick={() =>
                      patch({
                        maxParticipants: Math.max(
                          2,
                          (Number.isFinite(draft.maxParticipants)
                            ? Math.round(draft.maxParticipants)
                            : 2) - 1,
                        ),
                      })
                    }
                  >
                    <Minus size={15} aria-hidden="true" />
                  </button>
                  <input
                    className={styles.stepInput}
                    type="number"
                    inputMode="numeric"
                    min={2}
                    max={30}
                    value={draft.maxParticipants}
                    aria-label="人数上限"
                    onChange={(event) =>
                      patch({
                        maxParticipants: event.target.value === '' ? 0 : Number(event.target.value),
                      })
                    }
                  />
                  <span className={styles.stepUnit}>人</span>
                  <button
                    type="button"
                    className={styles.stepBtn}
                    aria-label="增加人数"
                    disabled={draft.maxParticipants >= 30}
                    onClick={() =>
                      patch({
                        maxParticipants: Math.min(
                          30,
                          Math.max(
                            2,
                            (Number.isFinite(draft.maxParticipants)
                              ? Math.round(draft.maxParticipants)
                              : 2) + 1,
                          ),
                        ),
                      })
                    }
                  >
                    <Plus size={15} aria-hidden="true" />
                  </button>
                </div>
              </Field>

              <Field label="出行方式">
                <div className={styles.chipRow} role="group" aria-label="出行方式">
                  {TRANSPORTS.map((transport) => (
                    <button
                      key={transport}
                      type="button"
                      className={cx('chip', draft.transport === transport && 'is-active')}
                      aria-pressed={draft.transport === transport}
                      onClick={() => patch({ transport })}
                    >
                      {TRANSPORT_META[transport]}
                    </button>
                  ))}
                </div>
              </Field>
            </div>
          </section>

          <section className={styles.panel}>
            <SectionHead
              icon={Coins}
              title="费用规则"
              desc="预算为人均预估，不是支付承诺；演示版不涉及真实收款。"
            />

            <Field
              label="费用方式"
              required
              error={errors.feeMode}
              hint={
                draft.feeMode
                  ? FEE_MODE_META[draft.feeMode].hint
                  : '提前说清费用规则，能减少现场沟通成本'
              }
            >
              <div className={styles.chipRow} role="group" aria-label="费用方式">
                {(Object.keys(FEE_MODE_META) as FeeMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    className={cx('chip', draft.feeMode === mode && 'is-active')}
                    aria-pressed={draft.feeMode === mode}
                    onClick={() => patch({ feeMode: mode })}
                  >
                    {FEE_MODE_META[mode].label}
                  </button>
                ))}
              </div>
            </Field>

            <div className={styles.fieldGrid}>
              <Field
                label="人均预算下限"
                error={errors.budgetMin}
                hint="单位：元"
                htmlFor="budget-min"
              >
                <div className={styles.moneyRow}>
                  <span className={styles.moneyPrefix}>¥</span>
                  <TextInput
                    id="budget-min"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step={10}
                    value={draft.budgetMin === 0 ? '' : draft.budgetMin}
                    placeholder="0"
                    onChange={(event) =>
                      patch({
                        budgetMin:
                          event.target.value === '' ? 0 : Math.max(0, Number(event.target.value)),
                      })
                    }
                    invalid={Boolean(errors.budgetMin)}
                  />
                </div>
              </Field>

              <Field
                label="人均预算上限"
                error={errors.budgetMax}
                hint="免费 / 待协商时可留 0"
                htmlFor="budget-max"
              >
                <div className={styles.moneyRow}>
                  <span className={styles.moneyPrefix}>¥</span>
                  <TextInput
                    id="budget-max"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step={10}
                    value={draft.budgetMax === 0 ? '' : draft.budgetMax}
                    placeholder="0"
                    onChange={(event) =>
                      patch({
                        budgetMax:
                          event.target.value === '' ? 0 : Math.max(0, Number(event.target.value)),
                      })
                    }
                    invalid={Boolean(errors.budgetMax)}
                  />
                </div>
              </Field>
            </div>
          </section>

          <section className={styles.panel}>
            <SectionHead
              icon={Tag}
              title="活动介绍"
              desc="写清楚活动流程、适合谁，以及需要提前准备什么。"
            />

            <Field
              label="活动介绍"
              required
              error={errors.description}
              hint={`${draft.description.length}/500 字，至少 10 字`}
              htmlFor="activity-description"
            >
              <TextArea
                id="activity-description"
                value={draft.description}
                onChange={(event) => patch({ description: event.target.value })}
                placeholder="例如：从湖光序曲出发沿绿道走到磨山北门，全程约 6 公里，节奏偏慢，适合想散步和拍照的人。"
                maxLength={500}
                invalid={Boolean(errors.description)}
              />
            </Field>

            <Field
              label="注意事项"
              hint="选填，例如：穿舒适的鞋、带水、下雨顺延。"
              htmlFor="activity-notes"
            >
              <TextArea
                id="activity-notes"
                value={draft.notes}
                onChange={(event) => patch({ notes: event.target.value })}
                placeholder="集合后准时出发，迟到请提前在群聊说一声。"
                maxLength={200}
              />
            </Field>

            <Field
              label="兴趣标签"
              error={errors.tags}
              hint={`最多 5 个，当前 ${draft.tags.length}/5。点选常用标签，或输入后按 Enter 添加。`}
            >
              <div className={styles.tagArea}>
                {draft.tags.length > 0 && (
                  <div className={styles.tagSelected}>
                    {draft.tags.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        className={cx('tag', 'tag--pink', styles.removableTag)}
                        onClick={() => removeTag(tag)}
                        aria-label={`移除标签 ${tag}`}
                      >
                        {tag}
                        <X size={12} aria-hidden="true" />
                      </button>
                    ))}
                  </div>
                )}

                <div className={styles.tagAddRow}>
                  <TextInput
                    value={tagInput}
                    onChange={(event) => setTagInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        addTag(tagInput);
                      }
                    }}
                    placeholder="输入自定义标签，按 Enter 添加"
                    maxLength={12}
                    aria-label="输入兴趣标签"
                    invalid={Boolean(errors.tags)}
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    iconLeft={<Plus size={14} />}
                    onClick={() => addTag(tagInput)}
                    disabled={!tagInput.trim()}
                  >
                    添加
                  </Button>
                </div>

                <div className={styles.presetRow}>
                  {COMMON_TAGS.filter((tag) => !draft.tags.includes(tag)).map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      className={cx('chip', styles.presetChip)}
                      onClick={() => addTag(tag)}
                      disabled={draft.tags.length >= 5}
                    >
                      + {tag}
                    </button>
                  ))}
                </div>
              </div>
            </Field>
          </section>

          <section className={styles.panel}>
            <SectionHead
              icon={Route}
              title="路线节点"
              desc="选填。有路线时，参与者会更容易判断强度与节奏。"
            />

            {routes.length > 0 ? (
              <div className={styles.routeList}>
                {routes.map((route, index) => (
                  <div key={index} className={styles.routeRow}>
                    <div className={styles.routeHead}>
                      <span className={styles.routeIndex}>节点 {index + 1}</span>
                      <button
                        type="button"
                        className={styles.removeRoute}
                        onClick={() => removeRoute(index)}
                        aria-label={`删除节点 ${index + 1}`}
                      >
                        <X size={14} aria-hidden="true" />
                        删除
                      </button>
                    </div>
                    <div className={styles.routeFields}>
                      <TextInput
                        value={route.name}
                        onChange={(event) => updateRoute(index, { name: event.target.value })}
                        placeholder="地点名称"
                        maxLength={20}
                        aria-label={`节点 ${index + 1} 名称`}
                      />
                      <TextInput
                        value={route.note}
                        onChange={(event) => updateRoute(index, { note: event.target.value })}
                        placeholder="说明（选填）"
                        maxLength={40}
                        aria-label={`节点 ${index + 1} 说明`}
                      />
                      <div className={styles.stayRow}>
                        <TextInput
                          type="number"
                          inputMode="numeric"
                          min={5}
                          max={240}
                          step={5}
                          value={route.stayMinutes}
                          onChange={(event) =>
                            updateRoute(index, {
                              stayMinutes:
                                event.target.value === '' ? 0 : Number(event.target.value),
                            })
                          }
                          aria-label={`节点 ${index + 1} 停留分钟`}
                        />
                        <span className={styles.unit}>分钟</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className={styles.inlineEmpty}>
                还没有路线节点。可以先发布活动，之后再补充；如果活动本身没有固定路线，也可以不填。
              </p>
            )}

            <div className={styles.routeActions}>
              <Button variant="secondary" size="sm" iconLeft={<Plus size={14} />} onClick={addRoute}>
                添加路线节点
              </Button>
              <span className={styles.routeHint}>
                {filledRoutePoints.length > 0
                  ? `将提交 ${filledRoutePoints.length} 个节点；名称为空的节点会自动忽略`
                  : '名称为空的节点不会提交'}
              </span>
            </div>
            <p className={styles.rulesHint}>
              <Info size={13} aria-hidden="true" />
              演示版不接地图 API，路线只展示结构化节点，不会生成实时导航。
            </p>
          </section>

          <div className={styles.actions}>
            <Button variant="secondary" onClick={handleBack}>
              取消
            </Button>
            <Button size="lg" iconLeft={<Rocket size={16} />} onClick={handleSubmit}>
              发布活动
            </Button>
          </div>
        </div>

        <ActivityPreview draft={draft} routeCount={filledRoutePoints.length} />
      </div>

      <ConfirmDialog
        open={backOpen}
        title="放弃这次编辑？"
        description="你有未保存的活动信息，返回后这些内容会丢失。"
        confirmText="放弃编辑"
        cancelText="继续编辑"
        danger
        onConfirm={() => navigate('/my')}
        onClose={() => setBackOpen(false)}
      />
    </div>
  );
}

import { useApp } from '@/store/AppStore';
import { Button } from '@/components/ui';
import { useToast } from '@/components/ui';
import { ArrowRight, CircleCheck, Sparkles } from '@/components/ui/icons';

/**
 * 演示入口（PRD §2.1 / 交互规格 §2.1）
 * 目的：面试官打开链接后不需要注册就能进入，并且清楚知道这是作品集演示环境。
 */
export function WelcomeGate() {
  const { state, dismissDemoNotice, switchUser, track } = useApp();
  const toast = useToast();

  if (state.demoDataDismissed) return null;

  const enter = (asOrganizer: boolean) => {
    if (asOrganizer) switchUser('u_chenyu');
    dismissDemoNotice();
    track('demo_enter', { as_organizer: asOrganizer });
    toast.success(asOrganizer ? '已进入组织者视角' : '已进入参与者视角');
  };

  return (
    <div className="welcome" role="dialog" aria-modal="true" aria-label="HOPPA 演示入口">
      <div className="welcome__card">
        <div className="welcome__brand">HOPPA</div>
        <p className="welcome__tagline">线上相遇，线下来聚。</p>
        <p className="welcome__desc">
          同城轻社交与活动组队产品的可交互 MVP：发现一场具体的小活动，申请加入，
          和同好完成一次真实的线下见面，再留下一张旅行名片。
        </p>

        <ul className="stack stack--sm" style={{ marginTop: 18, fontSize: 13, color: 'var(--ink-2)' }}>
          {[
            '10–15 条武汉活动演示数据，覆盖 City Walk / 美食 / 展览 / 桌游 / 运动 / 演出',
            '参与者与组织者双视角：申请、审核、群聊、签到、评价、旅行名片',
            '所有数据保存在本地，不请求定位、不拨打真实电话、不接入真实支付',
          ].map((line) => (
            <li className="row row--top" style={{ gap: 8 }} key={line}>
              <CircleCheck size={15} color="var(--pink-500)" style={{ marginTop: 3, flex: 'none' }} />
              <span>{line}</span>
            </li>
          ))}
        </ul>

        <div className="welcome__actions">
          <Button
            variant="primary"
            size="lg"
            iconLeft={<Sparkles size={16} />}
            iconRight={<ArrowRight size={16} />}
            onClick={() => enter(false)}
          >
            以参与者身份进入
          </Button>
          <Button variant="secondary" size="lg" onClick={() => enter(true)}>
            以组织者身份进入
          </Button>
        </div>

        <p className="welcome__meta">
          作品集演示环境 · 数据为模拟数据 · 演示身份可随时切换 · 建议使用 Chrome / Edge 浏览器
        </p>
      </div>
    </div>
  );
}

import { NavLink, Outlet } from 'react-router-dom';
import { useApp } from '@/store/AppStore';
import { Avatar } from '@/components/ui';
import {
  CalendarDays,
  CircleUser,
  House,
  MapPin,
  MessageCircle,
  Plus,
  Settings,
  Users,
} from '@/components/ui/icons';
import { DemoTools } from './DemoTools';

const NAV = [
  { to: '/', label: '首页', icon: House, end: true },
  { to: '/city', label: '同城', icon: MapPin, end: false },
  { to: '/buddy', label: '找搭子', icon: Users, end: false },
  { to: '/messages', label: '消息', icon: MessageCircle, end: false },
  { to: '/my', label: '我的活动', icon: CalendarDays, end: false },
  { to: '/me', label: '个人中心', icon: CircleUser, end: false },
];

const BOTTOM_NAV = [
  { to: '/', label: '首页', icon: House, end: true },
  { to: '/city', label: '同城', icon: MapPin, end: false },
  { to: '/buddy', label: '找搭子', icon: Users, end: false },
  { to: '/create', label: '发布', icon: Plus, end: false, cta: true },
  { to: '/me', label: '我的', icon: CircleUser, end: false },
];

export function AppShell() {
  const { state, currentUser, myConversations } = useApp();

  const pendingForMe = state.applications.filter((application) => {
    if (application.status !== 'pending') return false;
    const activity = state.activities.find((a) => a.id === application.activityId);
    return activity?.organizerId === currentUser.id;
  }).length;

  const myActivityCount = state.members.filter((m) => m.userId === currentUser.id).length;
  const organizedCount = state.activities.filter((a) => a.organizerId === currentUser.id).length;

  return (
    <div className="shell">
      <aside className="sidebar" aria-label="主导航">
        <div className="brand">
          <svg className="brand__mark" viewBox="0 0 40 40" aria-hidden="true">
            <defs>
              <linearGradient id="brandGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#ff5fa2" />
                <stop offset="100%" stopColor="#a35cff" />
              </linearGradient>
            </defs>
            <rect x="2" y="2" width="36" height="36" rx="12" fill="url(#brandGrad)" />
            <path
              d="M13 12h6a2.5 2.5 0 0 1 0 5h-1v2h-2v-2h-1a2.5 2.5 0 0 1 0-5Zs8 8h6v6a2.5 2.5 0 0 1-5 0v-1h-1v-5Z"
              fill="#fff"
              opacity="0.92"
            />
            <circle cx="15" cy="14.5" r="1.4" fill="#ff5fa2" />
          </svg>
          <div>
            <div className="brand__word">HOPPA</div>
            <div className="brand__tag">线上相遇 · 线下来聚</div>
          </div>
        </div>

        <nav className="side-nav">
          {NAV.map((item) => {
            const Icon = item.icon;
            const badge =
              item.to === '/messages'
                ? myConversations.length
                : item.to === '/my'
                  ? pendingForMe
                  : 0;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  isActive ? 'side-nav__item is-active' : 'side-nav__item'
                }
              >
                <Icon size={18} aria-hidden="true" />
                <span className="side-nav__label">{item.label}</span>
                {badge > 0 && <span className="side-nav__count">{badge}</span>}
              </NavLink>
            );
          })}
        </nav>

        <div className="sidebar__footer">
          <div className="sidebar__demo">
            <strong style={{ display: 'block', marginBottom: 2 }}>作品集演示环境</strong>
            所有活动、用户与聊天均为本地模拟数据；演示身份可随时切换，刷新后保留。
          </div>
          <NavLink to="/me" className="sidebar__user" aria-label="打开个人中心">
            <Avatar user={currentUser} size="sm" />
            <span className="sidebar__user-text">
              <span className="sidebar__user-name">{currentUser.nickname}</span>
              <span className="sidebar__user-role">
                参与 {myActivityCount} · 发起 {organizedCount}
              </span>
            </span>
            <Settings size={15} style={{ color: 'var(--ink-3)' }} aria-hidden="true" />
          </NavLink>
        </div>
      </aside>

      <div className="shell__main">
        <header className="topbar">
          <NavLink to="/" className="topbar__brand" aria-label="返回首页">
            HOPPA
          </NavLink>
          <span className="topbar__spacer" />
          <NavLink to="/buddy" className="icon-btn" aria-label="搜索活动">
            <Users size={19} />
          </NavLink>
          <NavLink to="/messages" className="icon-btn" aria-label="消息" style={{ position: 'relative' }}>
            <MessageCircle size={19} />
            {myConversations.length > 0 && (
              <span
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  top: 7,
                  right: 8,
                  width: 7,
                  height: 7,
                  borderRadius: 999,
                  background: 'var(--pink-500)',
                  border: '1.5px solid #fff',
                }}
              />
            )}
          </NavLink>
        </header>

        <main className="shell__content" id="main">
          <Outlet />
        </main>
      </div>

      <nav className="bottom-nav" aria-label="底部导航">
        {BOTTOM_NAV.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                [
                  'bottom-nav__item',
                  isActive ? 'is-active' : '',
                  item.cta ? 'bottom-nav__item--cta' : '',
                ]
                  .filter(Boolean)
                  .join(' ')
              }
            >
              {item.cta ? (
                <>
                  <span className="bottom-nav__cta">
                    <Icon size={22} aria-hidden="true" />
                  </span>
                  <span>{item.label}</span>
                </>
              ) : (
                <>
                  <Icon size={21} aria-hidden="true" />
                  <span>{item.label}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      <DemoTools />
    </div>
  );
}

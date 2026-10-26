import { useEffect, useRef, useState } from 'react';
import { useApp } from '@/store/AppStore';
import { Avatar, Button, ConfirmDialog } from '@/components/ui';
import { useToast } from '@/components/ui';
import { RotateCcw, Sparkles, X, Info } from '@/components/ui/icons';
import { cx } from '@/lib/format';

export function DemoTools() {
  const { state, currentUser, switchUser, resetDemoData } = useApp();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="demo-fab"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="打开演示工具"
      >
        {open ? <X size={14} /> : <Sparkles size={14} />}
        演示工具
      </button>

      {open && (
        <div className="demo-panel" ref={panelRef} role="dialog" aria-label="演示工具">
          <div className="demo-panel__head">
            <span className="demo-panel__title">演示工具</span>
            <span className="demo-badge">DEMO</span>
          </div>
          <div className="demo-panel__body">
            <p className="tiny faint" style={{ margin: '2px 2px 6px', lineHeight: 1.6 }}>
              切换演示身份来分别体验「参与者」和「组织者」视角。所有数据保存在浏览器 localStorage，
              不上传服务器。
            </p>
            {state.users.map((user) => {
              const organized = state.activities.filter((a) => a.organizerId === user.id).length;
              const joined = state.members.filter((m) => m.userId === user.id).length;
              return (
                <button
                  key={user.id}
                  type="button"
                  className={cx('demo-user', user.id === currentUser.id && 'is-active')}
                  onClick={() => {
                    switchUser(user.id);
                    toast.success(`已切换为「${user.nickname}」`);
                  }}
                >
                  <Avatar user={user} size="sm" />
                  <span className="demo-user__meta">
                    <span className="demo-user__name">{user.nickname}</span>
                    <span className="demo-user__bio">
                      发起 {organized} · 参与 {joined} · {user.bio.slice(0, 14)}
                    </span>
                  </span>
                  {user.id === currentUser.id && <span className="demo-badge">当前</span>}
                </button>
              );
            })}
            <div
              className="row row--between"
              style={{
                marginTop: 8,
                padding: '8px 6px 0',
                borderTop: '1px dashed var(--line)',
                fontSize: 11.5,
                color: 'var(--ink-3)',
              }}
            >
              <span className="row" style={{ gap: 5 }}>
                <Info size={12} />
                本地埋点事件
              </span>
              <span className="mono">{state.events.length} 条</span>
            </div>
          </div>
          <div className="demo-panel__foot">
            <Button
              variant="secondary"
              size="sm"
              block
              iconLeft={<RotateCcw size={14} />}
              onClick={() => setConfirmReset(true)}
            >
              重置演示数据
            </Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmReset}
        title="重置演示数据？"
        description="将清空你在本浏览器的所有操作（新建活动、申请、消息、评价和资料修改），恢复到初始演示数据。此操作不可撤销。"
        confirmText="确认重置"
        danger
        onClose={() => setConfirmReset(false)}
        onConfirm={() => {
          resetDemoData();
          toast.success('演示数据已重置');
        }}
      />
    </>
  );
}

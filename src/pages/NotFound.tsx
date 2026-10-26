import { Link } from 'react-router-dom';
import { EmptyState } from '@/components/ui';
import { Compass } from '@/components/ui/icons';

export default function NotFoundPage() {
  return (
    <div className="page">
      <EmptyState
        icon={<Compass size={22} />}
        title="这个页面走丢了"
        description="链接可能已经失效，或者地址输错了。回到首页继续看看这周有什么活动吧。"
        action={
          <Link to="/" className="btn btn--primary">
            回到首页
          </Link>
        }
      />
    </div>
  );
}

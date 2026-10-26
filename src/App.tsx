import { HashRouter, Route, Routes } from 'react-router-dom';
import { AppProvider } from '@/store/AppStore';
import { ToastProvider } from '@/components/ui';
import { AppShell } from '@/components/layout/AppShell';
import { ScrollToTop } from '@/components/layout/ScrollToTop';
import { WelcomeGate } from '@/components/layout/WelcomeGate';

import HomePage from '@/pages/Home';
import CityFeedPage from '@/pages/CityFeed';
import FindBuddyPage from '@/pages/FindBuddy';
import ActivityDetailPage from '@/pages/ActivityDetail';
import CreateActivityPage from '@/pages/CreateActivity';
import MyActivitiesPage from '@/pages/MyActivities';
import ManageActivityPage from '@/pages/ManageActivity';
import MessagesPage from '@/pages/Messages';
import ChatPage from '@/pages/Chat';
import RoutePlanPage from '@/pages/RoutePlan';
import ProfilePage from '@/pages/Profile';
import SafetyCenterPage from '@/pages/SafetyCenter';
import ReviewPage from '@/pages/ReviewPage';
import TravelCardPage from '@/pages/TravelCard';
import NotFoundPage from '@/pages/NotFound';

/**
 * 路由用 HashRouter：作品集要部署到 GitHub Pages / 本地静态预览，
 * 深链接不依赖服务器 rewrite，刷新不会 404。
 */
export default function App() {
  return (
    <HashRouter>
      <AppProvider>
        <ToastProvider>
          <ScrollToTop />
          <Routes>
            <Route element={<AppShell />}>
              <Route index element={<HomePage />} />
              <Route path="city" element={<CityFeedPage />} />
              <Route path="buddy" element={<FindBuddyPage />} />
              <Route path="activity/:id" element={<ActivityDetailPage />} />
              <Route path="create" element={<CreateActivityPage />} />
              <Route path="my" element={<MyActivitiesPage />} />
              <Route path="manage/:id" element={<ManageActivityPage />} />
              <Route path="messages" element={<MessagesPage />} />
              <Route path="messages/:id" element={<ChatPage />} />
              <Route path="route/:id" element={<RoutePlanPage />} />
              <Route path="me" element={<ProfilePage />} />
              <Route path="safety/:id" element={<SafetyCenterPage />} />
              <Route path="review/:id" element={<ReviewPage />} />
              <Route path="card/:id" element={<TravelCardPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
          <WelcomeGate />
        </ToastProvider>
      </AppProvider>
    </HashRouter>
  );
}

import { lazy } from 'react';
import { Suspense } from 'react';
import { useAuthContext } from '@/context/useAuthContext';
import ActivityStreamToggle from './components/ActivityStreamToggle';
import LeftSideBarToggle from './components/LeftSideBarToggle';
import ProfileDropdown from './components/ProfileDropdown';
import SearchBox from './components/SearchBox';
import ThemeCustomizerToggle from './components/ThemeCustomizerToggle';
import ThemeModeToggle from './components/ThemeModeToggle';
const AppsDropdown = lazy(() => import('./components/AppsDropdown'));
const Notifications = lazy(() => import('./components/Notifications'));
const TopNavigationBar = () => {
  const { user } = useAuthContext();
  const isBroker = user?.role === 'broker';
  return <header className="topbar">
      <div className="container-xxl">
        <div className="navbar-header">
          <div className="d-flex align-items-center gap-2">
            <LeftSideBarToggle />

            {!isBroker && <SearchBox />}
          </div>
          <div className="d-flex align-items-center gap-1">
            <ThemeModeToggle />

            {!isBroker && <>
              <Suspense>
                <AppsDropdown />
              </Suspense>
              <Suspense>
                <Notifications />
              </Suspense>
              <ThemeCustomizerToggle />
              <ActivityStreamToggle />
            </>}

            <ProfileDropdown />
          </div>
        </div>
      </div>
    </header>;
};
export default TopNavigationBar;
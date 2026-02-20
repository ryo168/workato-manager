// ルートコンポーネント。ルーティング定義して各ページを lazy load してる。

import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import Spinner from "./components/Spinner";

const RecipesPage = lazy(() => import("./pages/RecipesPage"));
const JobsPage = lazy(() => import("./pages/JobsPage"));
const ConnectionsPage = lazy(() => import("./pages/ConnectionsPage"));
const ProjectsPage = lazy(() => import("./pages/ProjectsPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));

// ページ読み込み中のくるくる
function PageLoader() {
  return (
    <div className="flex h-full items-center justify-center">
      <Spinner />
    </div>
  );
}

function App() {
  return (
    <Layout>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<Navigate to="/recipes" replace />} />
          <Route path="/recipes" element={<RecipesPage />} />
          <Route path="/jobs" element={<JobsPage />} />
          <Route path="/connections" element={<ConnectionsPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </Suspense>
    </Layout>
  );
}

export default App;

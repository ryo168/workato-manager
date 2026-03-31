// ルートコンポーネント。ルーティング定義して各ページを lazy load してる。

import { lazy, Suspense } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import Layout from "./components/Layout";
import { DifyProvider } from "./context/DifyContext";
import { GeminiProvider } from "./context/GeminiContext";
import { WorkatoSpecProvider } from "./context/WorkatoSpecContext";
import Spinner from "./components/Spinner";

const RecipesPage = lazy(() => import("./pages/RecipesPage"));
const JobsPage = lazy(() => import("./pages/JobsPage"));
const ConnectionsPage = lazy(() => import("./pages/ConnectionsPage"));
const ProjectsPage = lazy(() => import("./pages/ProjectsPage"));
const ProjectDetailPage = lazy(() => import("./pages/ProjectDetailPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const DifyPage = lazy(() => import("./pages/DifyPage"));
const DeveloperPage = lazy(() => import("./pages/DeveloperPage"));
const DifyHistoryPage = lazy(() => import("./pages/DifyHistoryPage"));
const GeminiPage = lazy(() => import("./pages/GeminiPage"));
const MarkdownEditorPage = lazy(() => import("./pages/MarkdownEditorPage"));
const WorkatoSpecPage = lazy(() => import("./pages/WorkatoSpecPage"));

// ページ読み込み中のくるくる
function PageLoader() {
  return (
    <div className="flex h-full items-center justify-center">
      <Spinner />
    </div>
  );
}

function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.15, ease: "easeInOut" }}
        className="h-full"
      >
        <Suspense fallback={<PageLoader />}>
          <Routes location={location}>
            <Route path="/" element={<Navigate to="/recipes" replace />} />
            <Route path="/recipes" element={<RecipesPage />} />
            <Route path="/jobs" element={<JobsPage />} />
            <Route path="/connections" element={<ConnectionsPage />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/projects/:id" element={<ProjectDetailPage />} />
            <Route path="/dify" element={<DifyPage />} />
            <Route path="/dify/history" element={<DifyHistoryPage />} />
            <Route path="/gemini" element={<GeminiPage />} />
            <Route path="/markdown-editor" element={<MarkdownEditorPage />} />
            <Route path="/workato-spec" element={<WorkatoSpecPage />} />
            <Route path="/developer" element={<DeveloperPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </Suspense>
      </motion.div>
    </AnimatePresence>
  );
}

function App() {
  return (
    <DifyProvider>
      <GeminiProvider>
        <WorkatoSpecProvider>
          <Layout>
            <AnimatedRoutes />
          </Layout>
        </WorkatoSpecProvider>
      </GeminiProvider>
    </DifyProvider>
  );
}

export default App;

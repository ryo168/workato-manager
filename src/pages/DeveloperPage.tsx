// 開発者ページ。開発者モード有効時のみ表示。

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Wrench } from "lucide-react";
import { PAGE, HEADER_ROW } from "../lib/tw";

export default function DeveloperPage() {
  const navigate = useNavigate();
  const [isDev] = useState(
    () => localStorage.getItem("developer-mode") === "true",
  );

  useEffect(() => {
    if (!isDev) navigate("/settings", { replace: true });
  }, [isDev, navigate]);

  if (!isDev) return null;

  return (
    <div className={PAGE}>
      <div className={HEADER_ROW}>
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-200 text-gray-500">
            <Wrench size={20} />
          </span>
          <h1 className="text-xl font-bold text-gray-600">Developer</h1>
        </div>
      </div>
    </div>
  );
}

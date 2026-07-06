import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { trpc } from "./trpc";
import ProjectList from "./pages/ProjectList";
import ProjectDetail from "./pages/ProjectDetail";
import LiveWalkthrough from "./pages/LiveWalkthrough";

function App() {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [page, setPage] = useState<"walkthrough" | "list" | "detail">("walkthrough");

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { refetchOnWindowFocus: false, retry: 1 },
        },
      })
  );

  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: "/trpc",
        }),
      ],
    })
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <div className="app">
          <header className="header">
            <div className="header-logo">
              AI Video Guide <span>— Admin</span>
            </div>
            <nav className="header-nav">
              <button
                className={`nav-btn${page === "walkthrough" ? " active" : ""}`}
                onClick={() => { setPage("walkthrough"); setSelectedProjectId(null); }}
              >
                Live Walkthrough
              </button>
              <button
                className={`nav-btn${page === "list" ? " active" : ""}`}
                onClick={() => { setPage("list"); setSelectedProjectId(null); }}
              >
                Projects
              </button>
            </nav>
          </header>
          <main className="main">
            {page === "walkthrough" && <LiveWalkthrough />}
            {page === "list" && !selectedProjectId && (
              <ProjectList
                onSelectProject={(id) => { setSelectedProjectId(id); setPage("detail"); }}
              />
            )}
            {page === "detail" && (
              <ProjectDetail
                projectId={selectedProjectId!}
                onBack={() => { setPage("list"); setSelectedProjectId(null); }}
              />
            )}
          </main>
        </div>
      </QueryClientProvider>
    </trpc.Provider>
  );
}

export default App;

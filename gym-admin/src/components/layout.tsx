import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { ChatbotWidget } from "./chatbot";

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen w-full bg-background">
      <Sidebar />
      <div className="flex flex-col sm:pl-64">
        <Header />
        <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
          {children}
        </main>
      </div>
      <ChatbotWidget />
    </div>
  );
}

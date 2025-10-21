import { Home, Smartphone, Send, MessageSquare, Settings, Key, Users, Webhook, Bot } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Button } from "./ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function MobileBottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const [currentPage, setCurrentPage] = useState(0);

  const navItems = [
    { icon: Home, label: "Dashboard", path: "/dashboard" },
    { icon: Smartphone, label: "Devices", path: "/devices" },
    { icon: Send, label: "Broadcast", path: "/broadcast" },
    { icon: MessageSquare, label: "Templates", path: "/templates" },
    { icon: Users, label: "Contacts", path: "/contacts" },
    { icon: Bot, label: "Chatbot", path: "/chatbot" },
    { icon: Key, label: "API Keys", path: "/api-keys" },
    { icon: Webhook, label: "Webhooks", path: "/webhooks" },
    { icon: Settings, label: "Settings", path: "/settings" },
  ];

  const itemsPerPage = 5;
  const totalPages = Math.ceil(navItems.length / itemsPerPage);
  const startIndex = currentPage * itemsPerPage;
  const visibleItems = navItems.slice(startIndex, startIndex + itemsPerPage);

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-t z-50 safe-bottom">
      <div className="flex items-center justify-between h-16 px-1">
        {totalPages > 1 && (
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 flex-shrink-0"
            onClick={() => setCurrentPage((prev) => Math.max(0, prev - 1))}
            disabled={currentPage === 0}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
        )}
        
        <div className="flex items-center justify-around flex-1">
          {visibleItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 px-2 py-2 rounded-lg transition-colors min-w-[50px]",
                  isActive
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                <Icon className={cn("w-5 h-5", isActive && "scale-110")} />
                <span className="text-[9px] font-medium truncate w-full text-center">{item.label}</span>
              </button>
            );
          })}
        </div>

        {totalPages > 1 && (
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 flex-shrink-0"
            onClick={() => setCurrentPage((prev) => Math.min(totalPages - 1, prev + 1))}
            disabled={currentPage === totalPages - 1}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        )}
      </div>
      
      {totalPages > 1 && (
        <div className="flex justify-center gap-1 pb-2">
          {Array.from({ length: totalPages }).map((_, index) => (
            <div
              key={index}
              className={cn(
                "w-1.5 h-1.5 rounded-full transition-colors",
                index === currentPage ? "bg-primary" : "bg-muted-foreground/30"
              )}
            />
          ))}
        </div>
      )}
    </nav>
  );
}

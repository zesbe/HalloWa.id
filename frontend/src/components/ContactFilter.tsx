import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, User, Grid } from "lucide-react";

interface ContactFilterProps {
  activeFilter: "all" | "groups" | "individuals";
  onFilterChange: (filter: "all" | "groups" | "individuals") => void;
  counts: {
    all: number;
    groups: number;
    individuals: number;
  };
}

export function ContactFilter({ activeFilter, onFilterChange, counts }: ContactFilterProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
      <Button
        variant={activeFilter === "all" ? "default" : "outline"}
        onClick={() => onFilterChange("all")}
        size="sm"
        className="flex items-center gap-1.5 sm:gap-2 whitespace-nowrap h-9 touch-manipulation flex-shrink-0"
      >
        <Grid className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        <span className="text-xs sm:text-sm">Semua</span>
        <Badge variant={activeFilter === "all" ? "secondary" : "outline"} className="text-[10px] sm:text-xs h-4 sm:h-5">
          {counts.all}
        </Badge>
      </Button>
      <Button
        variant={activeFilter === "individuals" ? "default" : "outline"}
        onClick={() => onFilterChange("individuals")}
        size="sm"
        className="flex items-center gap-1.5 sm:gap-2 whitespace-nowrap h-9 touch-manipulation flex-shrink-0"
      >
        <User className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        <span className="text-xs sm:text-sm">Individu</span>
        <Badge variant={activeFilter === "individuals" ? "secondary" : "outline"} className="text-[10px] sm:text-xs h-4 sm:h-5">
          {counts.individuals}
        </Badge>
      </Button>
      <Button
        variant={activeFilter === "groups" ? "default" : "outline"}
        onClick={() => onFilterChange("groups")}
        size="sm"
        className="flex items-center gap-1.5 sm:gap-2 whitespace-nowrap h-9 touch-manipulation flex-shrink-0"
      >
        <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        <span className="text-xs sm:text-sm">Grup</span>
        <Badge variant={activeFilter === "groups" ? "secondary" : "outline"} className="text-[10px] sm:text-xs h-4 sm:h-5">
          {counts.groups}
        </Badge>
      </Button>
    </div>
  );
}

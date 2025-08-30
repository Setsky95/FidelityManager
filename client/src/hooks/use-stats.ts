// src/hooks/use-stats.ts (ejemplo)
import { useQuery } from "@tanstack/react-query";
import { FirebaseService } from "@/lib/firebase";

const DEFAULT = {
  totalMembers: 0,
  totalPoints: 0,
  newThisMonth: 0,
  averagePoints: 0,
};

export function useStats() {
  const { data = DEFAULT, isLoading } = useQuery({
    queryKey: ["/api/stats"],
    queryFn: FirebaseService.getMemberStats,
  });
  return { stats: data, isLoading };
}

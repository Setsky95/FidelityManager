import { useQuery } from "@tanstack/react-query";
import { FirebaseService } from "@/lib/firebase";

export function useStats() {
  const { data: stats = {
    totalMembers: 0,
    totalPoints: 0,
    newThisMonth: 0,
    averagePoints: 0,
  }, isLoading } = useQuery({
    queryKey: ["/api/stats"],
    queryFn: FirebaseService.getMemberStats,
  });

  return {
    stats,
    isLoading,
  };
}

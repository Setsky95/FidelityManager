import { useQuery } from "@tanstack/react-query";
import { FirebaseService } from "@/lib/firebase";
import type { MovementType } from "@shared/schema";

export function useMovements(filters: {
  memberId?: string;
  type?: MovementType;
  from?: Date;
  to?: Date;
}) {
  const { data = [], isLoading } = useQuery({
    queryKey: ["/api/movements", filters],
    queryFn: () => FirebaseService.getMovements(filters),
  });
  return { movements: data, isLoading };
}

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FirebaseService } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import type { InsertMember, UpdatePoints } from "@shared/schema";

export function useMembers() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: members = [], isLoading } = useQuery({
    queryKey: ["/api/members"],
    queryFn: FirebaseService.getMembers,
  });

  const addMember = useMutation({
    mutationFn: FirebaseService.addMember,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({
        title: "Éxito",
        description: "Socio agregado correctamente",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Error al agregar el socio",
        variant: "destructive",
      });
      console.error("Error adding member:", error);
    },
  });

  const updatePoints = useMutation({
    mutationFn: ({ memberId, currentPoints, update }: {
      memberId: string;
      currentPoints: number;
      update: UpdatePoints;
    }) => FirebaseService.updateMemberPoints(memberId, currentPoints, update),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({
        title: "Éxito",
        description: "Puntos actualizados correctamente",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Error al actualizar los puntos",
        variant: "destructive",
      });
      console.error("Error updating points:", error);
    },
  });

  const deleteMember = useMutation({
    mutationFn: FirebaseService.deleteMember,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({
        title: "Éxito",
        description: "Socio eliminado correctamente",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Error al eliminar el socio",
        variant: "destructive",
      });
      console.error("Error deleting member:", error);
    },
  });

  return {
    members,
    isLoading,
    addMember,
    updatePoints,
    deleteMember,
  };
}

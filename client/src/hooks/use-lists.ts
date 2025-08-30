// client/src/hooks/use-lists.ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FirebaseService } from "@/lib/firebase";

export type ListItem = {
  id: string;
  nombre: string;
  Ids: string; // CSV
};

export function useLists() {
  const qc = useQueryClient();

  const lists = useQuery<ListItem[]>({
    queryKey: ["lists"],
    queryFn: () => FirebaseService.getLists(),
  });

  const create = useMutation({
    mutationFn: (p: { nombre: string; ids: string[] }) =>
      FirebaseService.createList(p.nombre, p.ids),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lists"] });
    },
  });

  const remove = useMutation({
    mutationFn: (listId: string) => FirebaseService.deleteList(listId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lists"] });
    },
  });

  return { lists, create, remove };
}


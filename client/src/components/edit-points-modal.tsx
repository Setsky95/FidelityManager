import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { updatePointsSchema, type UpdatePoints, type Member } from "@shared/schema";
import { Save, X } from "lucide-react";

interface EditPointsModalProps {
  isOpen: boolean;
  onClose: () => void;
  member: Member | null;
  onUpdatePoints: (memberId: string, currentPoints: number, update: UpdatePoints) => Promise<void>;
  isLoading?: boolean;
}

export function EditPointsModal({ 
  isOpen, 
  onClose, 
  member, 
  onUpdatePoints, 
  isLoading 
}: EditPointsModalProps) {
  const form = useForm<UpdatePoints>({
    resolver: zodResolver(updatePointsSchema),
    defaultValues: {
      operation: "add",
      amount: 0,
      reason: "",
    },
  });

  const handleSubmit = async (data: UpdatePoints) => {
    if (!member) return;
    
    try {
      await onUpdatePoints(member.id, member.puntos, data);
      form.reset();
      onClose();
    } catch (error) {
      console.error("Error updating points:", error);
    }
  };

  const handleClose = () => {
    form.reset();
    onClose();
  };

  const getInitials = (nombre: string, apellido: string) => {
    return `${nombre.charAt(0)}${apellido.charAt(0)}`.toUpperCase();
  };

  if (!member) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]" data-testid="modal-edit-points">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-semibold text-gray-900">
              Editar Puntos
            </DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClose}
              data-testid="button-close-modal"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        {/* Member Info */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-primary bg-opacity-10 rounded-full flex items-center justify-center">
              <span className="text-lg font-medium text-primary">
                {getInitials(member.nombre, member.apellido)}
              </span>
            </div>
            <div className="ml-4">
              <div className="text-sm font-medium text-gray-900" data-testid="member-full-name">
                {member.nombre} {member.apellido}
              </div>
              <div className="text-sm text-gray-500" data-testid="member-email">
                {member.email}
              </div>
            </div>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <div>
              <FormLabel className="block text-sm font-medium text-gray-700 mb-2">
                Puntos Actuales
              </FormLabel>
              <div className="text-2xl font-bold text-gray-900" data-testid="current-points">
                {member.puntos}
              </div>
            </div>

            <FormField
              control={form.control}
              name="operation"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Operación</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-operation">
                        <SelectValue placeholder="Seleccionar operación" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="add">Agregar puntos</SelectItem>
                      <SelectItem value="subtract">Restar puntos</SelectItem>
                      <SelectItem value="set">Establecer puntos</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cantidad</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="number"
                      min="0"
                      placeholder="Ingrese la cantidad"
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      data-testid="input-points-amount"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Motivo (Opcional)</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      rows={3}
                      placeholder="Descripción del motivo del cambio..."
                      data-testid="textarea-reason"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isLoading}
                data-testid="button-cancel"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isLoading}
                data-testid="button-update-points"
              >
                {isLoading ? (
                  <LoadingSpinner className="mr-2" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Actualizar Puntos
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

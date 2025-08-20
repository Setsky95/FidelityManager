import { useState } from "react";
import { MembersTable } from "@/components/members-table";
import { AddMemberModal } from "@/components/add-member-modal";
import { EditPointsModal } from "@/components/edit-points-modal";
import { useMembers } from "@/hooks/use-members";
import type { Member, InsertMember, UpdatePoints } from "@shared/schema";

export default function Members() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);

  const { 
    members, 
    isLoading, 
    addMember, 
    updatePoints, 
    deleteMember 
  } = useMembers();

  const handleAddMember = async (member: InsertMember) => {
    await addMember.mutateAsync(member);
  };

  const handleEditPoints = (member: Member) => {
    setSelectedMember(member);
    setIsEditModalOpen(true);
  };

  const handleUpdatePoints = async (memberId: string, currentPoints: number, update: UpdatePoints) => {
    await updatePoints.mutateAsync({ memberId, currentPoints, update });
  };

  const handleViewMember = (member: Member) => {
    console.log("View member:", member);
  };

  const handleDeleteMember = async (memberId: string) => {
    if (window.confirm("¿Está seguro de que desea eliminar este socio?")) {
      await deleteMember.mutateAsync(memberId);
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-card shadow-sm border-b border-gray-200">
        <div className="px-6 py-4">
          <h2 className="text-2xl font-semibold text-gray-900" data-testid="page-title">
            Gestión de Socios
          </h2>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto bg-surface">
        <div className="p-6">
          <MembersTable
            members={members}
            isLoading={isLoading}
            onEditPoints={handleEditPoints}
            onViewMember={handleViewMember}
            onDeleteMember={handleDeleteMember}
          />
        </div>
      </main>

      {/* Modals */}
      <AddMemberModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAddMember={handleAddMember}
        isLoading={addMember.isPending}
      />

      <EditPointsModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        member={selectedMember}
        onUpdatePoints={handleUpdatePoints}
        isLoading={updatePoints.isPending}
      />
    </div>
  );
}

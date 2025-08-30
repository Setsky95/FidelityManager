import { useState } from "react";
import { Bell, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatsCards } from "@/components/stats-cards";
import { MembersTable } from "@/components/members-table";
import { AddMemberModal } from "@/components/add-member-modal";
import { EditPointsModal } from "@/components/edit-points-modal";
import { useMembers } from "@/hooks/use-members";
import { QuickAddPoints } from "@/components/quick-add-points";

import { useStats } from "@/hooks/use-stats";
import type { Member, InsertMember, UpdatePoints } from "@shared/schema";

export default function Dashboard() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);

  const { 
    members, 
    isLoading: membersLoading, 
    addMember, 
    updatePoints, 
    deleteMember 
  } = useMembers();
  
  const { stats, isLoading: statsLoading } = useStats();

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
    // TODO: Implement view member details
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
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center">
            <h2 className="text-2xl font-semibold text-gray-900" data-testid="page-title">
              Dashboard de Socios
            </h2>
          </div>
          
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="sm" className="relative" data-testid="button-notifications">
              <Bell className="h-5 w-5 text-gray-600" />
              <span className="absolute -top-1 -right-1 h-3 w-3 bg-destructive rounded-full"></span>
            </Button>
            
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                <User className="h-4 w-4 text-white" />
              </div>
              <span className="text-sm font-medium text-gray-700" data-testid="user-name">
                Admin
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Dashboard Content */}
      <main className="flex-1 overflow-y-auto bg-surface">
        <div className="p-6">
          {/* Stats Cards */}
          <StatsCards stats={stats} isLoading={statsLoading} />

          
<QuickAddPoints
  members={members}
  isSubmitting={updatePoints.isPending}
  onAddPoints={async (memberId, amount) => {
    const m = members.find((x) => x.id === memberId);
    if (!m) return;
    await updatePoints.mutateAsync({
      memberId,
      currentPoints: m.puntos,
      update: { operation: "add", amount, reason: "Carga rápida" },
    });
  }}
/>
          {/* Members Management Section */}
          <MembersTable
            members={members}
            isLoading={membersLoading}
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
